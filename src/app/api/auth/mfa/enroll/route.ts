import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseAuthProvider } from "@/lib/auth/auth-provider"
import { readSession } from "@/lib/auth/session-broker"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"

export const dynamic = "force-dynamic"

/**
 * Begin TOTP enrolment.
 *
 * First enrolment is the only step allowed from a freshly email-OTP-verified
 * AAL1 session, and it grants no privileged capability: the backend still
 * requires `aal2` from refreshed current and next AAL before any privileged
 * mutation.
 *
 * The QR image and raw seed are one-time browser-visible privileged material.
 * They are handed to a dynamic `private, no-store` render and never written to
 * a cookie, a log, audit metadata or any cacheable response.
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

  const enrolment = await createSupabaseAuthProvider().enrollTotp(
    outcome.session.accessToken,
  )

  // An unknown outcome may have created a factor, so it is never retried
  // blind and never reported as failure; the customer sees the factor list.
  const response = NextResponse.redirect(
    canonicalRedirect(
      enrolment.status === "ok" ? "/auth/mfa/challenge" : "/auth/mfa/enroll",
    ),
    303,
  )
  response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate")
  return response
}
