import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseAuthProvider } from "@/lib/auth/auth-provider"
import {
  PRE_AUTH_ADDRESS_COOKIE,
  PRE_AUTH_CSRF_COOKIE,
  PRE_AUTH_EMAIL_COOKIE,
  PRE_AUTH_TRANSACTION_COOKIE,
  preAuthCookieOptions,
} from "@/lib/auth/pre-auth-cookies"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { readServerEnvironment } from "@/lib/env/server"
import { importCsrfKey, issueCsrfToken } from "@/lib/security/csrf"
import { guardMutation } from "@/server/actions/mutation-guard"
import { hmacEmailIdentity, sealEmailAddress } from "@/server/actions/pre-auth"
import { canonicalRedirect } from "@/server/actions/redirects"

export const dynamic = "force-dynamic"

/**
 * Request an email OTP.
 *
 * The reply is identical whether or not the address is known, so it cannot be
 * used to enumerate accounts. The code never enters a URL, and the redirect
 * target is a fixed same-origin path rather than anything the caller supplied.
 *
 * This is also where the pre-auth proof stops being generic: it is reissued
 * bound to an HMAC of the email identity, so a proof minted for one address
 * cannot later verify a code for another. The address itself is never stored.
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

  if (!guard.ok || guard.binding.kind !== "pre-auth") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const email = guard.form.get("email")
  if (typeof email !== "string" || email.trim() === "") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  // Ask the provider to send the code. This call was missing: the route bound a
  // proof, set cookies and redirected to the verify page without ever asking
  // anyone to send anything, so sign-in could not succeed for any address. The
  // omission was invisible because the reply below is identical whatever
  // happens, which is the same property that stops account enumeration.
  await createSupabaseAuthProvider().requestEmailOtp(email)

  const emailIdentityHmac = await hmacEmailIdentity(email)
  const csrfToken = await issueCsrfToken(
    await importCsrfKey(readServerEnvironment().csrfSigningKey),
    {
      kind: "pre-auth",
      transactionId: guard.binding.transactionId,
      emailIdentityHmac,
      generation: 1,
    },
    {
      issuedAt: Math.floor(Date.now() / 1000),
      lifetimeSeconds: SESSION_POLICY.emailOtpLifetimeSeconds,
    },
  )

  const response = NextResponse.redirect(canonicalRedirect("/auth/verify"), 303)
  response.cookies.set({
    name: PRE_AUTH_EMAIL_COOKIE,
    value: emailIdentityHmac,
    ...preAuthCookieOptions,
  })
  response.cookies.set({
    name: PRE_AUTH_ADDRESS_COOKIE,
    value: await sealEmailAddress(email),
    ...preAuthCookieOptions,
  })
  response.cookies.set({
    name: PRE_AUTH_CSRF_COOKIE,
    value: csrfToken,
    ...preAuthCookieOptions,
  })
  response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate")
  return response
}
