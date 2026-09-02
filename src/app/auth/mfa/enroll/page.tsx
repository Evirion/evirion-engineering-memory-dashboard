import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * First TOTP enrolment starts from the freshly email-OTP-verified AAL1
 * session and grants no privileged capability until challenge and verify plus
 * a refreshed current and next AAL prove `aal2`.
 *
 * The QR image and raw seed are one-time browser-visible privileged material.
 * Displaying them is deliberately not done here yet: it requires rendering the
 * enrolment response itself under `private, no-store` without it reaching
 * router cache, prefetch, analytics, logs or error capture, and that lands
 * with the live MFA flow in EEM-9/07. This page therefore promises only what
 * it does, which is to register the factor and move to confirmation.
 */
const MfaEnrollPage = async () => {
  const csrfToken = await readSessionCsrfToken()

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Set up two-factor authentication
        </h2>
        <p className="text-sm text-slate-600">
          Owner and Admin actions require a second factor. Enrolling does not grant
          those actions until you complete one challenge.
        </p>
      </div>
      <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Enrolling registers a factor against your account and then asks you to confirm
        one code. Nothing privileged becomes available until that confirmation succeeds.
      </p>
      <form action="/api/auth/mfa/enroll" method="post" className="flex flex-col gap-4">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Begin enrolment
        </button>
      </form>
    </section>
  )
}

export default MfaEnrollPage
