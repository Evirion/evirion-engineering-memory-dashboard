import { NextResponse, type NextRequest } from "next/server"

import {
  PRE_AUTH_CSRF_COOKIE,
  PRE_AUTH_TRANSACTION_COOKIE,
  createTransactionId,
  preAuthCookieOptions,
} from "@/lib/auth/pre-auth-cookies"
import { createSupabaseAuthProvider, extractAal } from "@/lib/auth/auth-provider"
import { landingForAuthenticatedReader } from "@/lib/auth/authenticated-landing"
import { SESSION_COOKIE_BASE, type CookieInstruction } from "@/lib/auth/session-cookies"
import {
  accessTokenNeedsRefresh,
  readSession,
  writeSession,
  type SessionReadOutcome,
} from "@/lib/auth/session-broker"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { readServerEnvironment } from "@/lib/env/server"
import { NONCE_HEADER, buildSecurityHeaders, createNonce } from "@/lib/security/headers"
import { csrfBoundSessionId, importCsrfKey, issueCsrfToken } from "@/lib/security/csrf"
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
  const carried = readSession(
    Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
    ),
  )

  // The access token lives fifteen minutes and nothing renewed it, so every
  // session died a quarter of an hour after sign-in: the backend refused the
  // stale token, the protected shell sent the reader to sign in, and the guard
  // below sent them back. `accessTokenNeedsRefresh` was written for this and
  // never called. The proxy is where it belongs — it already reads the session
  // and is one of the two places allowed to write a cookie.
  const renewal = await renewIfDue(carried)
  const session = renewal?.session ?? carried
  if (renewal !== undefined) {
    requestHeaders.set(
      "cookie",
      withSessionCookies(requestHeaders.get("cookie"), renewal.instructions),
    )
  }
  // A live session makes the pre-auth pages and the placeholder root wrong, and
  // nothing stopped a signed-in reader walking back into sign-in and opening a
  // second transaction against their own session. The decision is taken here
  // because the session is already read for the CSRF binding, and it writes
  // nothing: a redirect must not clear or refresh a cookie on its way past.
  if (session.status === "active") {
    const landing = landingForAuthenticatedReader(
      request.nextUrl.pathname,
      request.headers.get("sec-fetch-mode"),
      extractAal(session.session.accessToken) !== "aal1",
    )
    if (landing !== undefined) {
      return NextResponse.redirect(new URL(landing, request.nextUrl.origin), 303)
    }
  }

  // The proof is bound to one provider session, and a browser that signs in a
  // second time keeps the cookie from the first. Issuing it only when absent
  // therefore handed a returning reader a proof bound to a session they no
  // longer hold, and every mutation was refused as forged — observed on the
  // deployed Console, where a correct authenticator code landed back on
  // sign-in. Replacing it whenever it names another session is what this file
  // already claimed to do.
  const sessionCsrf =
    session.status === "active" &&
    !request.nextUrl.pathname.startsWith("/api/") &&
    csrfBoundSessionId(request.cookies.get(SESSION_CSRF_COOKIE)?.value) !==
      session.session.providerSessionId
      ? await issueSessionCsrfToken(session.session.providerSessionId)
      : undefined

  if (sessionCsrf !== undefined) {
    // Replaced rather than appended: a duplicate name would leave the page
    // reading whichever copy the parser reaches first, which is the stale one.
    requestHeaders.set(
      "cookie",
      withCookie(requestHeaders.get("cookie"), SESSION_CSRF_COOKIE, sessionCsrf),
    )
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  for (const instruction of renewal?.instructions ?? []) {
    response.cookies.set({ ...instruction, sameSite: "lax" })
  }

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

type Renewal = {
  readonly session: SessionReadOutcome
  readonly instructions: CookieInstruction[]
}

/**
 * Exchange the refresh token while the access token still has a minute left.
 *
 * A failure is not treated as a dead session. The carried token may still be
 * good for that final minute, and the backend is the authority on whether it
 * is; turning a transient provider hiccup into a forced sign-out would be a
 * worse answer than letting the request through and being refused honestly.
 */
const renewIfDue = async (
  outcome: SessionReadOutcome,
): Promise<Renewal | undefined> => {
  if (outcome.status !== "active" || !accessTokenNeedsRefresh(outcome.session)) {
    return undefined
  }

  const issued = await createSupabaseAuthProvider().refresh(
    outcome.session.refreshToken,
  )
  if (issued.status !== "ok") return undefined

  const session = {
    ...outcome.session,
    accessToken: issued.value.accessToken,
    refreshToken: issued.value.refreshToken,
    accessTokenExpiresAt: issued.value.accessTokenExpiresAt,
  }
  return {
    session: { ...outcome, session },
    // The absolute window is the one sign-in opened. Renewal extends the
    // token, never the session.
    instructions: writeSession(session),
  }
}

/** Replace every chunk of the session cookie, since a renewal rewrites them all. */
const withSessionCookies = (
  existing: string | null,
  instructions: readonly CookieInstruction[],
): string =>
  appendCookies(
    (existing ?? "")
      .split("; ")
      .filter((pair) => pair !== "" && !pair.startsWith(`${SESSION_COOKIE_BASE}.`))
      .join("; ") || null,
    instructions
      .filter((instruction) => instruction.value !== "")
      .map((instruction): [string, string] => [instruction.name, instruction.value]),
  )

const appendCookies = (existing: string | null, pairs: [string, string][]): string =>
  [existing, ...pairs.map(([name, value]) => `${name}=${value}`)]
    .filter((part): part is string => Boolean(part))
    .join("; ")

const withCookie = (existing: string | null, name: string, value: string): string =>
  appendCookies(
    (existing ?? "")
      .split("; ")
      .filter((pair) => pair !== "" && !pair.startsWith(`${name}=`))
      .join("; ") || null,
    [[name, value]],
  )

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
