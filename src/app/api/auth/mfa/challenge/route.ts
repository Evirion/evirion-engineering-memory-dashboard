import { NextResponse, type NextRequest } from "next/server"

import { AUTH_OUTCOMES, AUTH_OUTCOME_PARAMETER } from "@/lib/auth/auth-outcome"
import { createAuthProviderForAccessToken } from "@/lib/auth/create-auth-provider"
import { readSession, writeSession } from "@/lib/auth/session-broker"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { readServerEnvironment } from "@/lib/env/server"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"
import { activateSession } from "@/server/adapters/console-api"

export const dynamic = "force-dynamic"

const SIX_DIGITS = /^\d{6}$/

/**
 * Every refusal the reader can act on says so.
 *
 * These all used to be a bare redirect back to the same page, which rendered
 * unchanged: pressing Verify appeared to do nothing at all, and a reader whose
 * authenticator held a factor that no longer existed had no way to learn it.
 */
const refused = (): NextResponse => {
  const target = new URL(canonicalRedirect("/auth/mfa/challenge"))
  target.searchParams.set(AUTH_OUTCOME_PARAMETER, AUTH_OUTCOMES.factorCodeRefused)
  return NextResponse.redirect(target, 303)
}

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
  if (typeof code !== "string" || !SIX_DIGITS.test(code)) return refused()

  const outcome = readSession(
    Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
    ),
  )
  if (outcome.status !== "active") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const provider = createAuthProviderForAccessToken(outcome.session.accessToken)
  const challenge = await provider.challengeTotp(outcome.session.accessToken)
  if (challenge.status !== "ok") return refused()

  const verified = await provider.verifyTotp(
    outcome.session.accessToken,
    challenge.value,
    code,
  )
  if (verified.status !== "ok") return refused()

  // The provider now says `aal2`, but the backend session is still the one the
  // email code opened, and it stays unusable until this transition runs. A
  // refusal here is not reported as a failed code: the reader's factor is
  // confirmed either way, and the Console reads its context next, which either
  // works or sends them back with a reason of its own.
  await activateSession(readServerEnvironment().consoleApiBaseUrl, {
    accessToken: verified.value.accessToken,
    correlationId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
  })

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
