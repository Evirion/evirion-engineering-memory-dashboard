import { NextResponse, type NextRequest } from "next/server"

import { guardMutation } from "@/server/actions/mutation-guard"
import { PRE_AUTH_TRANSACTION_COOKIE } from "@/lib/auth/pre-auth-cookies"
import { canonicalRedirect } from "@/server/actions/redirects"

export const dynamic = "force-dynamic"

/**
 * Request an email OTP.
 *
 * The response is identical whether or not the address is known, so it cannot
 * be used to enumerate accounts. The code never enters a URL, and the redirect
 * target is a fixed same-origin path rather than anything the caller supplied.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, (cookies) => {
    const transactionId = cookies[PRE_AUTH_TRANSACTION_COOKIE]
    return transactionId
      ? { kind: "pre-auth", transactionId, emailIdentityHmac: "", generation: 1 }
      : undefined
  })

  // A refusal is reported generically for the same anti-enumeration reason.
  const response = NextResponse.redirect(canonicalRedirect("/auth/verify"), 303)
  response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate")

  if (!guard.ok) {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  return response
}
