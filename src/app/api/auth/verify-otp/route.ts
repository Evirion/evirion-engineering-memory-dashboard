import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseAuthProvider } from "@/lib/auth/auth-provider"
import { admitVerifiedIdentity } from "@/lib/auth/identity-admission"
import {
  PRE_AUTH_EMAIL_COOKIE,
  PRE_AUTH_TRANSACTION_COOKIE,
  clearPreAuthCookies,
} from "@/lib/auth/pre-auth-cookies"
import { importProofKey, signBootstrapProof } from "@/lib/auth/bootstrap-proof"
import { writeSession } from "@/lib/auth/session-broker"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { readServerEnvironment } from "@/lib/env/server"
import { resolveSafeRedirect } from "@/lib/security/request-origin"
import { guardMutation } from "@/server/actions/mutation-guard"
import { hmacEmailIdentity } from "@/server/actions/pre-auth"
import { AUTH_OUTCOME_PARAMETER, AUTH_OUTCOMES } from "@/lib/auth/auth-outcome"
import { canonicalRedirect } from "@/server/actions/redirects"
import { SESSION_BOOTSTRAP_PATH, bootstrapSession } from "@/server/adapters/console-api"

export const dynamic = "force-dynamic"

/**
 * Any refusal returns the caller to sign-in with the pre-auth transaction
 * cleared, so a half-finished attempt cannot be resumed and no partial state
 * survives into the next request.
 */
const denied = (): NextResponse => {
  // One sentence for every cause. The reply stays indistinguishable between a
  // wrong code, an expired one, a failed CSRF check and a refused admission,
  // which is the enumeration property; what changes is that the reader is now
  // told something rather than bounced in silence.
  const target = canonicalRedirect("/auth/sign-in")
  target.searchParams.set(AUTH_OUTCOME_PARAMETER, AUTH_OUTCOMES.verificationFailed)
  const response = NextResponse.redirect(target, 303)
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
    if (!transactionId) return undefined
    return {
      kind: "pre-auth",
      transactionId,
      emailIdentityHmac: cookies[PRE_AUTH_EMAIL_COOKIE] ?? "",
      generation: 1,
    }
  })

  if (!guard.ok || guard.binding.kind !== "pre-auth") return denied()

  const email = guard.form.get("email")
  const code = guard.form.get("code")
  if (typeof email !== "string" || typeof code !== "string") return denied()

  // The proof is bound to the address the code was sent to. Submitting a
  // different address with a valid proof is refused before any provider call.
  if ((await hmacEmailIdentity(email)) !== guard.binding.emailIdentityHmac)
    return denied()

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
  const environment = readServerEnvironment()
  const invitationId = guard.form.get("invitationId")
  const idempotencyKey = `bootstrap:${user.value.sessionId}`
  const body = {
    invitationId: typeof invitationId === "string" ? invitationId : null,
  }

  const { proof } = await signBootstrapProof(
    await importProofKey(environment.bootstrapProofSigningKey),
    {
      accessToken: verification.value.accessToken,
      method: "POST",
      path: SESSION_BOOTSTRAP_PATH,
      subject: user.value.id,
      sessionId: user.value.sessionId,
      preAuthTransactionId:
        guard.binding.kind === "pre-auth" ? guard.binding.transactionId : "",
      invitationId: body.invitationId,
      idempotencyKey,
      body,
      issuedAt: now,
    },
  )

  const bootstrap = await bootstrapSession(environment.consoleApiBaseUrl, {
    accessToken: verification.value.accessToken,
    correlationId: idempotencyKey,
    idempotencyKey,
    body,
    bootstrapProof: proof,
  })

  // No bootstrap, no session. A transient failure used to keep the cookies for
  // a retry the contract described and no code performed, which left the
  // browser signed in against a backend that had never heard of the session —
  // exactly the state a reader reached on staging on 2026-09-06. Failing closed
  // costs one more emailed code, and a code costs nothing at thirty an hour.
  if (!bootstrap.ok) return denied()
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
