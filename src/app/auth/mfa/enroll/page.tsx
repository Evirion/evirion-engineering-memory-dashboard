export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * First TOTP enrolment starts from the freshly email-OTP-verified AAL1
 * session and grants no privileged capability until challenge and verify plus
 * a refreshed current and next AAL prove `aal2`.
 *
 * The QR image and raw seed are one-time browser-visible privileged material.
 * They are rendered only on this dynamic `private, no-store` response and are
 * never carried into router cache, prefetch, analytics, logs or error capture.
 */
const MfaEnrollPage = () => (
  <section className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight">
        Set up two-factor authentication
      </h2>
      <p className="text-sm text-slate-600">
        Owner and Admin actions require a second factor. Enrolling does not grant those
        actions until you complete one challenge.
      </p>
    </div>
    <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      The setup code is shown once and is not recoverable from this page afterwards. If
      you leave before finishing, start again from the beginning.
    </p>
    <form action="/api/auth/mfa/enroll" method="post" className="flex flex-col gap-4">
      <button
        type="submit"
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Begin enrolment
      </button>
    </form>
  </section>
)

export default MfaEnrollPage
