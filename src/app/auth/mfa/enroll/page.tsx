import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { TotpEnrolmentPanel } from "@/components/auth/totp-enrolment-panel"
import { createAuthProviderForAccessToken } from "@/lib/auth/create-auth-provider"
import { readSession } from "@/lib/auth/session-broker"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * First TOTP enrolment, starting from the email-code session and granting
 * nothing until one challenge succeeds.
 *
 * The seed is created here rather than by the form that led here, and that is
 * deliberate. Supabase returns the QR and the raw secret exactly once, at
 * creation, and neither may enter a cookie, a URL, a log or any cacheable
 * response. The only place they can be shown is the response of the request
 * that created them, so the creation and the render are one request under
 * `private, no-store`.
 *
 * That makes this a GET with an effect, so it creates a factor only when the
 * account has none. A reader who reloads after scanning keeps the secret their
 * app holds and is sent to confirm it; abandoning it is an explicit choice on
 * the challenge page, not something a refresh does to them.
 */
const MfaEnrollPage = async () => {
  const jar = await cookies()
  const outcome = readSession(
    Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])),
  )
  if (outcome.status !== "active") redirect("/auth/sign-in")

  const provider = createAuthProviderForAccessToken(outcome.session.accessToken)
  const factors = await provider.listTotpFactors(outcome.session.accessToken)
  if (factors.status !== "ok") redirect("/auth/sign-in")

  // An established factor is never replaced from here. Its holder proves it on
  // the challenge page; replacing one is account recovery, which is its own
  // ceremony with its own evidence.
  //
  // An unconfirmed one is not replaced either, and that is the whole point. It
  // used to be discarded and re-created on every visit, so a reader who had
  // already scanned the code and then reloaded — or arrived here twice for any
  // other reason — silently lost the secret their app held, and every code
  // they entered was for a factor that no longer existed. They are sent to
  // confirm the one they have, and `/api/auth/mfa/restart` is the explicit way
  // to abandon it.
  if (factors.value.verified.length + factors.value.unverified.length > 0) {
    redirect("/auth/mfa/challenge")
  }

  const enrolment = await provider.enrollTotp(outcome.session.accessToken)
  if (enrolment.status !== "ok") redirect("/auth/sign-in")

  return (
    <TotpEnrolmentPanel
      csrfToken={await readSessionCsrfToken()}
      qrCode={enrolment.value.qrCode}
      secret={enrolment.value.secret}
    />
  )
}

export default MfaEnrollPage
