import type { Repository } from "@contracts/console"

import type { RepositoryControls } from "@/lib/repositories/presentation"
import { policyTerm } from "@/lib/repositories/vocabulary"

/**
 * The entitlement and policy controls.
 *
 * Three rules hold across all of them. The idempotency key is minted once when
 * the form is rendered, so a duplicate click sends the same key and receives
 * the stored receipt rather than a second command. The expected version is the
 * one the backend last reported and is forwarded unchanged. And no control
 * claims success: the page re-reads the repository after the redirect, so what
 * is shown afterwards is the committed projection.
 */

export type ActionContext = {
  readonly repository: Repository
  readonly controls: RepositoryControls
  readonly csrfToken: string
  /** One per rendered form, so a double submit cannot become two commands. */
  readonly idempotencyKeys: Readonly<Record<string, string>>
}

const Hidden = ({
  repositoryId,
  idempotencyKey,
  expectedVersion,
  csrfToken,
}: {
  repositoryId: string
  idempotencyKey: string
  expectedVersion: number | null
  csrfToken: string
}) => (
  <>
    <input type="hidden" name="csrfToken" value={csrfToken} />
    <input type="hidden" name="repositoryId" value={repositoryId} />
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <input
      type="hidden"
      name="expectedVersion"
      value={expectedVersion === null ? "" : String(expectedVersion)}
    />
  </>
)

const submit =
  "rounded border border-slate-400 px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
const field = "rounded border border-slate-300 px-2 py-1 text-sm"

export const ActivateForm = ({
  repository,
  controls,
  csrfToken,
  idempotencyKeys,
}: ActionContext) =>
  !controls.canActivate ? null : (
    <form
      action="/api/repositories/activate"
      method="post"
      className="flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-slate-900">Activate this repository</h2>
      {/* REPO-002 fixes this wording. It is requirement text, not invented copy. */}
      <p className="text-sm text-slate-700">Evirion will be allowed to:</p>
      <ul className="list-disc pl-5 text-sm text-slate-700">
        <li>process future merged pull requests;</li>
        <li>prepare historical pull requests;</li>
        <li>run approved model extraction;</li>
        <li>retain usage for this repository.</li>
      </ul>
      <p className="text-sm text-slate-700">
        {policyTerm("operational-authorization").meaning}
      </p>
      <Hidden
        repositoryId={repository.id}
        idempotencyKey={idempotencyKeys["activate"] ?? ""}
        expectedVersion={repository.entitlement?.version ?? null}
        csrfToken={csrfToken}
      />
      <label className="flex items-center gap-2 text-sm text-slate-900">
        <input type="checkbox" name="confirmationAccepted" />I confirm this
      </label>
      <button type="submit" className={submit}>
        Activate repository
      </button>
    </form>
  )

export const DisableForm = ({
  repository,
  controls,
  csrfToken,
  idempotencyKeys,
}: ActionContext) =>
  !controls.canDisable ? null : (
    <form
      action="/api/repositories/disable"
      method="post"
      className="flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-slate-900">Disable this repository</h2>
      <p className="text-sm text-slate-700">
        New work stops. Everything already recorded for this repository is kept, and
        disabling does not delete history or usage.
      </p>
      <Hidden
        repositoryId={repository.id}
        idempotencyKey={idempotencyKeys["disable"] ?? ""}
        expectedVersion={repository.entitlement?.version ?? null}
        csrfToken={csrfToken}
      />
      <label className="flex flex-col gap-1 text-sm text-slate-900">
        Reason, optional
        <input type="text" name="reason" maxLength={500} className={field} />
      </label>
      <button type="submit" className={submit}>
        Disable repository
      </button>
    </form>
  )

export const RequestChangeForm = ({
  repository,
  controls,
  csrfToken,
  idempotencyKeys,
  candidates,
}: ActionContext & { readonly candidates: readonly Repository[] }) =>
  !controls.canRequestChange || candidates.length === 0 ? null : (
    <form
      action="/api/repositories/request-change"
      method="post"
      className="flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-slate-900">
        Request a different repository
      </h2>
      <p className="text-sm text-slate-700">
        This organization&rsquo;s allowance is managed by Evirion, so replacing a
        repository is an operator action. Sending this records the request; it does not
        free the slot or activate anything.
      </p>
      <Hidden
        repositoryId={repository.id}
        idempotencyKey={idempotencyKeys["request-change"] ?? ""}
        expectedVersion={repository.entitlement?.version ?? null}
        csrfToken={csrfToken}
      />
      <label className="flex flex-col gap-1 text-sm text-slate-900">
        Repository to use instead
        <select name="requestedRepositoryId" className={field}>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.nameWithOwner}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-900">
        Reason, optional
        <input type="text" name="reason" maxLength={500} className={field} />
      </label>
      <button type="submit" className={submit}>
        Request change
      </button>
    </form>
  )

export const PolicyForm = ({
  repository,
  controls,
  csrfToken,
  idempotencyKeys,
}: ActionContext) =>
  !controls.canChangePolicy ? null : (
    <form
      action="/api/repositories/policy"
      method="post"
      className="flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-slate-900">Live processing</h2>
      <p className="text-sm text-slate-700">{policyTerm("source-work").meaning}</p>
      <Hidden
        repositoryId={repository.id}
        idempotencyKey={idempotencyKeys["policy"] ?? ""}
        expectedVersion={repository.policy?.version ?? null}
        csrfToken={csrfToken}
      />
      <label className="flex flex-col gap-1 text-sm text-slate-900">
        Live processing mode
        <select
          name="mode"
          defaultValue={repository.policy?.mode ?? "OFF"}
          className={field}
        >
          <option value="OFF">Off, no source work and no model call</option>
          <option value="SOURCE_ONLY">Source only, no model call</option>
        </select>
      </label>
      {/* Alpha has no "approve this live envelope later" action: future
          behaviour changes through a versioned policy update, and historical
          work goes through the guarded import workflow. */}
      <button type="submit" className={submit}>
        Save live processing
      </button>
    </form>
  )

export const ConsentForm = ({
  repository,
  controls,
  csrfToken,
  idempotencyKeys,
}: ActionContext) =>
  !controls.canChangePolicy ? null : (
    <details className="rounded border border-slate-300 bg-white px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        Turn on automatic extraction
      </summary>
      <form
        action="/api/repositories/policy"
        method="post"
        className="mt-3 flex flex-col gap-3"
      >
        <p className="text-sm text-slate-700">
          {policyTerm("customer-consent").meaning}
        </p>
        <p className="text-sm text-slate-700">
          {policyTerm("operational-authorization").meaning}
        </p>
        <Hidden
          repositoryId={repository.id}
          idempotencyKey={idempotencyKeys["consent"] ?? ""}
          expectedVersion={repository.policy?.version ?? null}
          csrfToken={csrfToken}
        />
        <input type="hidden" name="mode" value="AUTO_EXTRACT" />
        <label className="flex flex-col gap-1 text-sm text-slate-900">
          Model profiles, comma separated
          {/* No contract endpoint enumerates the available profiles, so an
              existing consent is the only reliable prefill there is. */}
          <input
            type="text"
            name="allowedModelProfiles"
            required
            defaultValue={
              repository.effectiveConsent?.allowedModelProfiles.join(", ") ?? ""
            }
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-900">
          Maximum model calls
          <input
            type="number"
            name="callCeiling"
            min={1}
            max={1000000000}
            required
            defaultValue={repository.effectiveConsent?.callCeiling ?? 100}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-900">
          Maximum budget in USD
          <input
            type="number"
            name="budgetCeilingUsd"
            min="0.000001"
            step="0.000001"
            required
            defaultValue={repository.effectiveConsent?.budgetCeilingUsd ?? "10.000000"}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-900">
          Retry policy
          <select
            name="retryPolicy"
            defaultValue={repository.effectiveConsent?.retryPolicy ?? "NO_RETRY"}
            className={field}
          >
            <option value="NO_RETRY">Do not retry</option>
            <option value="BOUNDED_TRANSPORT_RETRY">Bounded transport retry</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-900">
          Expires
          <input type="datetime-local" name="expiresAt" required className={field} />
        </label>
        <button type="submit" className={submit}>
          Record consent and turn on automatic extraction
        </button>
      </form>
    </details>
  )

/**
 * Why a control the customer might expect is not here.
 *
 * Silence would read as a bug. An operator-managed allowance is a legitimate
 * state with no customer action, and saying so is not an error message.
 */
export const OperatorManagedNotice = ({
  controls,
}: {
  controls: RepositoryControls
}) =>
  !controls.operatorManaged ? null : (
    <p className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      Evirion manages this organization&rsquo;s repository allowance, so activating a
      replacement is an operator action rather than something to do here.
    </p>
  )
