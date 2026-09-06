import { NextResponse, type NextRequest } from "next/server"

import {
  PRE_AUTH_CSRF_COOKIE,
  PRE_AUTH_TRANSACTION_COOKIE,
  createTransactionId,
  preAuthCookieOptions,
} from "@/lib/auth/pre-auth-cookies"
import { landingForAuthenticatedReader } from "@/lib/auth/authenticated-landing"
import { readSession } from "@/lib/auth/session-broker"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { readServerEnvironment } from "@/lib/env/server"
import { NONCE_HEADER, buildSecurityHeaders, createNonce } from "@/lib/security/headers"
import { importCsrfKey, issueCsrfToken } from "@/lib/security/csrf"
import {
  SESSION_CSRF_COOKIE,
  issueSessionCsrfToken,
  sessionCsrfCookie,
} from "@/server/actions/session-csrf"

/**
 * Next.js 16 calls this the proxy; it is the former middleware entry point.
 *
 * It does two things a Server Component cannot. It mints one CSP nonce per
 * response and binds it to the enforced header, so a warm instance can never
 * reuse a nonce. And it establishes the pre-auth transaction and its bound
 * CSRF proof, because only a proxy or a route handler may write a cookie.
 */
export const proxy = async (request: NextRequest): Promise<NextResponse> => {
  const nonce = createNonce()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(NONCE_HEADER, nonce)

  const needsPreAuth =
    request.nextUrl.pathname.startsWith("/auth/") &&
    !request.cookies.has(PRE_AUTH_TRANSACTION_COOKIE)

  const transactionId = needsPreAuth
    ? createTransactionId()
    : (request.cookies.get(PRE_AUTH_TRANSACTION_COOKIE)?.value ?? "")

  let csrfToken: string | undefined
  if (needsPreAuth) {
    const environment = readServerEnvironment()
    csrfToken = await issueCsrfToken(
      await importCsrfKey(environment.csrfSigningKey),
      { kind: "pre-auth", transactionId, emailIdentityHmac: "", generation: 1 },
      {
        issuedAt: Math.floor(Date.now() / 1000),
        lifetimeSeconds: SESSION_POLICY.emailOtpLifetimeSeconds,
      },
    )
    // The page renders the proof from the forwarded request, so the very
    // first response already carries a usable form.
    requestHeaders.set(
      "cookie",
      appendCookies(request.headers.get("cookie"), [
        [PRE_AUTH_TRANSACTION_COOKIE, transactionId],
        [PRE_AUTH_CSRF_COOKIE, csrfToken],
      ]),
    )
  }

  // The post-authentication proof is bound to the live session, so it is
  // reissued whenever the session identity changes. A proof that survived a
  // logout or a session swap therefore no longer matches the expected binding.
  const session = readSession(
    Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
    ),
  )
  // A live session makes the pre-auth pages and the placeholder root wrong, and
  // nothing stopped a signed-in reader walking back into sign-in and opening a
  // second transaction against their own session. The decision is taken here
  // because the session is already read for the CSRF binding, and it writes
  // nothing: a redirect must not clear or refresh a cookie on its way past.
  if (session.status === "active") {
    const landing = landingForAuthenticatedReader(
      request.nextUrl.pathname,
      request.headers.get("sec-fetch-mode"),
    )
    if (landing !== undefined) {
      return NextResponse.redirect(new URL(landing, request.nextUrl.origin), 303)
    }
  }

  const sessionCsrf =
    session.status === "active" &&
    !request.cookies.has(SESSION_CSRF_COOKIE) &&
    !request.nextUrl.pathname.startsWith("/api/")
      ? await issueSessionCsrfToken(session.session.providerSessionId)
      : undefined

  if (sessionCsrf !== undefined) {
    requestHeaders.set(
      "cookie",
      appendCookies(requestHeaders.get("cookie"), [[SESSION_CSRF_COOKIE, sessionCsrf]]),
    )
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  if (sessionCsrf !== undefined) {
    response.cookies.set(sessionCsrfCookie(sessionCsrf))
  }

  if (needsPreAuth && csrfToken !== undefined) {
    response.cookies.set({
      name: PRE_AUTH_TRANSACTION_COOKIE,
      value: transactionId,
      ...preAuthCookieOptions,
    })
    response.cookies.set({
      name: PRE_AUTH_CSRF_COOKIE,
      value: csrfToken,
      ...preAuthCookieOptions,
    })
  }

  for (const [name, value] of Object.entries(
    buildSecurityHeaders({
      nonce,
      isProduction: process.env.NODE_ENV === "production",
      // The GitHub App installation handoff is the one form target beyond this
      // origin, and it comes from configuration rather than from a literal.
      formActionOrigins: [readServerEnvironment().githubAppInstallUrl],
    }),
  )) {
    response.headers.set(name, value)
  }

  return response
}

const appendCookies = (existing: string | null, pairs: [string, string][]): string =>
  [existing, ...pairs.map(([name, value]) => `${name}=${value}`)]
    .filter((part): part is string => Boolean(part))
    .join("; ")

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
