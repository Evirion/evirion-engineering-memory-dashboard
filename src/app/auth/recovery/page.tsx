export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * Recovery is a request, not a self-service bypass.
 *
 * Alpha has no password and therefore no password reset. A lost factor or a
 * compromised address is resolved by an authorized Evirion operator with
 * claimant proof, approval, a cooldown, a final-owner guard and factor and
 * session revocation. Nothing on this page restores access by itself.
 */
const RecoveryPage = () => (
  <section className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight">Recover access</h2>
      <p className="text-sm text-slate-600">
        There is no password to reset. If you have lost your second factor or no longer
        control your email address, Evirion has to verify you before access is restored.
      </p>
    </div>
    <form action="/api/auth/recovery" method="post" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email address on the account
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </div>
      <button
        type="submit"
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Request recovery
      </button>
      <p className="text-xs text-slate-500">
        Submitting this starts a review. It does not sign you in and it does not change
        your factors.
      </p>
    </form>
  </section>
)

export default RecoveryPage
