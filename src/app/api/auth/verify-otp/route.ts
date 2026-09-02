import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseAuthProvider } from "@/lib/auth/auth-provider"
import { admitVerifiedIdentity } from "@/lib/auth/identity-admission"
import {
  PRE_AUTH_TRANSACTION_COOKIE,
  clearPreAuthCookies,
} from "@/lib/auth/pre-auth-cookies"
import { writeSession } from "@/lib/auth/session-broker"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { resolveSafeRedirect } from "@/lib/security/request-origin"
import { guardMutation } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"

export const dynamic = "force-dynamic"

/**
 * Any refusal returns the caller to sign-in with the pre-auth transaction
 * cleared, so a half-finished attempt cannot be resumed and no partial state
 * survives into the next request.
 */
const denied = (): NextResponse => {
  const response = NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  for (const instruction of clearPreAuthCookies()) {
    response.cookies.set({
      ...instruction,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    })
  }
  return response
}

/**
 * Verify the emailed code server-side and establish the session.
 *
 * `verifyOtp` runs here, never in the browser. The returned tokens go only
 * into host-only `__Host-` cookies, the form state is dropped, and the reply
 * is a `303` to a clean allowlisted path so no credential can reach a URL,
 * browser storage, logs, analytics or a third party.
 *
 * A lost provider response is not retried: repeating verification could
 * consume a second code, and the resulting provider session stays
 * unregistered and denied until an explicit cooldown-bound resend.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, (cookies) => {
    const transactionId = cookies[PRE_AUTH_TRANSACTION_COOKIE]
    return transactionId
      ? { kind: "pre-auth", transactionId, emailIdentityHmac: "", generation: 1 }
      : undefined
  })

  if (!guard.ok) return denied()

  const email = guard.form.get("email")
  const code = guard.form.get("code")
  if (typeof email !== "string" || typeof code !== "string") return denied()

  const provider = createSupabaseAuthProvider()
  const verification = await provider.verifyEmailOtp(email, code)

  // An unknown outcome is neither success nor failure. Nothing is registered
  // and nothing is retried; the customer starts a new generation explicitly.
  if (verification.status !== "ok") return denied()

  const user = await provider.getUser(verification.value.accessToken)
  if (user.status !== "ok") return denied()

  const admission = admitVerifiedIdentity(user.value)
  if (!admission.admitted) return denied()

  const now = Math.floor(Date.now() / 1000)
  const target = resolveSafeRedirect(guard.form.get("next") as string | null)
  const response = NextResponse.redirect(
    canonicalRedirect(target === "/" ? "/onboarding" : target),
    303,
  )

  for (const instruction of [
    ...clearPreAuthCookies(),
    ...writeSession(
      {
        accessToken: verification.value.accessToken,
        refreshToken: verification.value.refreshToken,
        providerSessionId: user.value.sessionId,
        accessTokenExpiresAt: verification.value.accessTokenExpiresAt,
        absoluteExpiresAt: now + SESSION_POLICY.absoluteSessionSeconds,
      },
      now,
    ),
  ]) {
    response.cookies.set({
      ...instruction,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    })
  }

  response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate")
  return response
}
