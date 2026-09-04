import { NextResponse, type NextRequest } from "next/server"

import { createAuthProviderForAccessToken } from "@/lib/auth/create-auth-provider"
import {
  INVALID_CHALLENGE,
  TOTP_REJECTED,
} from "@/lib/auth/reauthentication-result-codes"
import {
  readSession,
  writeSession,
  type StoredSession,
} from "@/lib/auth/session-broker"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { readServerEnvironment } from "@/lib/env/server"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"
import {
  clearReauthenticationState,
  readChallengeFromRequest,
  readPendingFromRequest,
  redirectBackForCeremony,
  replayPendingMutation,
  safeRedirectLocation,
} from "@/server/actions/reauthentication-resume"
import { issueSessionCsrfToken, sessionCsrfCookie } from "@/server/actions/session-csrf"
import { completeSessionReauthentication } from "@/server/adapters/reauthentication"

export const dynamic = "force-dynamic"

const SIX_DIGITS = /^\d{6}$/
const NO_STORE = "private, no-store, max-age=0, must-revalidate"

/**
 * Consume a step-up challenge after a fresh TOTP proof, then replay the
 * mutation the customer had paused.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const code = guard.form.get("totp")
  if (typeof code !== "string" || !SIX_DIGITS.test(code)) {
    return redirectBackForCeremony(request, "REQUEST_INVALID")
  }

  const pending = await readPendingFromRequest(request)
  const challenge = await readChallengeFromRequest(request)
  if (pending === undefined || challenge === undefined) {
    return redirectBackForCeremony(request, "REQUEST_INVALID")
  }

  const jar = Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  )
  const outcome = readSession(jar)
  if (outcome.status !== "active") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  if (outcome.session.providerSessionId !== challenge.providerSessionId) {
    return redirectBackForCeremony(request, INVALID_CHALLENGE)
  }

  const provider = createAuthProviderForAccessToken(outcome.session.accessToken)
  const totpChallenge = await provider.challengeTotp(outcome.session.accessToken)
  if (totpChallenge.status !== "ok") {
    return redirectBackForCeremony(request, INVALID_CHALLENGE)
  }

  const verified = await provider.verifyTotp(
    outcome.session.accessToken,
    totpChallenge.value,
    code,
  )
  if (verified.status !== "ok") {
    return redirectBackForCeremony(request, TOTP_REJECTED)
  }

  const environment = readServerEnvironment()
  const correlationId = crypto.randomUUID()
  const completion = await completeSessionReauthentication(
    {
      baseUrl: environment.consoleApiBaseUrl,
      accessToken: verified.value.accessToken,
      correlationId,
    },
    {
      actionClass: pending.actionClass,
      challengeId: challenge.challengeId,
      idempotencyKey: crypto.randomUUID(),
    },
  )

  if (!completion.ok) {
    if (
      completion.failure.kind === "error" &&
      (completion.failure.error.error.code === "CAPABILITY_REQUIRED" ||
        completion.failure.error.error.code === "RESOURCE_NOT_FOUND")
    ) {
      return redirectBackForCeremony(request, INVALID_CHALLENGE)
    }
    const failureCode =
      completion.failure.kind === "error"
        ? completion.failure.error.error.code
        : completion.failure.kind === "unreachable"
          ? "DEPENDENCY_UNAVAILABLE"
          : "UNSUPPORTED_SERVER_RESPONSE"
    return redirectBackForCeremony(request, failureCode)
  }

  const now = Math.floor(Date.now() / 1000)
  const upgraded: StoredSession = {
    accessToken: verified.value.accessToken,
    refreshToken: verified.value.refreshToken,
    providerSessionId: verified.value.sessionId || outcome.session.providerSessionId,
    accessTokenExpiresAt: verified.value.accessTokenExpiresAt,
    absoluteExpiresAt: Math.min(
      outcome.session.absoluteExpiresAt,
      now + SESSION_POLICY.absoluteSessionSeconds,
    ),
  }

  let replay: NextResponse
  try {
    replay = await replayPendingMutation(request, pending)
  } catch {
    return redirectBackForCeremony(request, "DEPENDENCY_UNAVAILABLE")
  }

  const location = replay.headers.get("location")
  if (location === null) {
    return redirectBackForCeremony(request, "UNSUPPORTED_SERVER_RESPONSE")
  }

  const safePath = safeRedirectLocation(location)
  if (safePath === undefined) {
    return redirectBackForCeremony(request, "UNSUPPORTED_SERVER_RESPONSE")
  }

  const response = NextResponse.redirect(canonicalRedirect(safePath), 303)
  response.headers.set("cache-control", NO_STORE)

  for (const instruction of writeSession(upgraded, now)) {
    response.cookies.set({
      ...instruction,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    })
  }

  response.cookies.set(
    sessionCsrfCookie(await issueSessionCsrfToken(upgraded.providerSessionId)),
  )

  clearReauthenticationState(response)
  return response
}
