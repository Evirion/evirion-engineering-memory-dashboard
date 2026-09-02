import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The AAL2 step-up. Passing it in the browser proves nothing on its own: the
 * backend enforces `aal2` for every privileged mutation, and a stale token
 * that still claims `aal2` after a factor change is refused there.
 */
const MfaChallengePage = async () => {
  const csrfToken = await readSessionCsrfToken()

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Enter your authenticator code
        </h2>
        <p className="text-sm text-slate-600">
          Open your authenticator app and enter the current six-digit code.
        </p>
      </div>
      <form
        action="/api/auth/mfa/challenge"
        method="post"
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <div className="flex flex-col gap-2">
          <label htmlFor="totp" className="text-sm font-medium">
            Authenticator code
          </label>
          <input
            id="totp"
            name="totp"
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            className="rounded border border-slate-300 px-3 py-2 font-mono text-sm tracking-widest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Verify
        </button>
      </form>
    </section>
  )
}

export default MfaChallengePage
