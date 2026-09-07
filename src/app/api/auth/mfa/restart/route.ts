import { NextResponse, type NextRequest } from "next/server"

import { createAuthProviderForAccessToken } from "@/lib/auth/create-auth-provider"
import { readSession } from "@/lib/auth/session-broker"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"

export const dynamic = "force-dynamic"

/**
 * Discard an authenticator that was never confirmed and start again.
 *
 * A reader who mis-scanned, or whose app holds a factor the account no longer
 * has, could otherwise only press Verify against a secret nobody shares. Only
 * an unconfirmed factor is discarded: replacing an established one is account
 * recovery, which is a different ceremony with its own evidence, and it is not
 * reachable from here.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const outcome = readSession(
    Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
    ),
  )
  if (outcome.status !== "active") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const provider = createAuthProviderForAccessToken(outcome.session.accessToken)
  const factors = await provider.listTotpFactors(outcome.session.accessToken)
  if (factors.status === "ok" && factors.value.verified.length === 0) {
    await Promise.all(
      factors.value.unverified.map((factorId) =>
        provider.unenrollTotp(outcome.session.accessToken, factorId),
      ),
    )
  }

  const response = NextResponse.redirect(canonicalRedirect("/auth/mfa/enroll"), 303)
  response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate")
  return response
}
