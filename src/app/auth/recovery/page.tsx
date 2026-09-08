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
      <p className="text-sm text-ink-secondary">
        There is no password to reset. If you have lost your second factor or no longer
        control your email address, Evirion has to verify you before access is restored.
      </p>
    </div>
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-secondary">
      <li>Contact Evirion support from an address or channel you still control.</li>
      <li>An authorized operator verifies that you are the account holder.</li>
      <li>
        After approval and a cooldown, your factors are reset and every existing session
        ends. You then sign in again with a fresh code.
      </li>
    </ol>
    <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-ink-secondary">
      There is deliberately no self-service form here. Recovery ends sessions and resets
      a second factor, so it is never something an unverified request can start. If the
      reset would leave your organization without an owner, it is refused.
    </p>
  </section>
)

export default RecoveryPage
