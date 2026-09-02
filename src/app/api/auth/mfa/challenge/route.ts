import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseAuthProvider } from "@/lib/auth/auth-provider"
import { readSession, writeSession } from "@/lib/auth/session-broker"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"

export const dynamic = "force-dynamic"

const SIX_DIGITS = /^\d{6}$/

/**
 * Complete the AAL2 step-up.
 *
 * Passing here proves nothing on its own: the backend enforces `aal2` for
 * every privileged mutation and refuses a stale token that still claims it
 * after a factor change. On success the session cookies are rewritten with the
 * upgraded tokens, so the next request carries the new assurance level.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const code = guard.form.get("totp")
  if (typeof code !== "string" || !SIX_DIGITS.test(code)) {
    return NextResponse.redirect(canonicalRedirect("/auth/mfa/challenge"), 303)
  }

  const outcome = readSession(
    Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
    ),
  )
  if (outcome.status !== "active") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const provider = createSupabaseAuthProvider()
  const challenge = await provider.challengeTotp(outcome.session.accessToken)
  if (challenge.status !== "ok") {
    return NextResponse.redirect(canonicalRedirect("/auth/mfa/challenge"), 303)
  }

  const verified = await provider.verifyTotp(
    outcome.session.accessToken,
    challenge.value,
    code,
  )
  if (verified.status !== "ok") {
    return NextResponse.redirect(canonicalRedirect("/auth/mfa/challenge"), 303)
  }

  const now = Math.floor(Date.now() / 1000)
  const response = NextResponse.redirect(canonicalRedirect("/onboarding"), 303)

  for (const instruction of writeSession(
    {
      accessToken: verified.value.accessToken,
      refreshToken: verified.value.refreshToken,
      providerSessionId: verified.value.sessionId || outcome.session.providerSessionId,
      accessTokenExpiresAt: verified.value.accessTokenExpiresAt,
      // Step-up never extends the absolute window the original sign-in opened.
      absoluteExpiresAt: Math.min(
        outcome.session.absoluteExpiresAt,
        now + SESSION_POLICY.absoluteSessionSeconds,
      ),
    },
    now,
  )) {
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
