import type { Repository } from "@contracts/console"

import type { RepositoryControls } from "@/lib/repositories/presentation"
import { offeredProfiles } from "@/lib/repositories/presentation"
import { policyTerm } from "@/lib/repositories/vocabulary"
import type { ModelProfileCatalogueView } from "@/server/queries/repositories"
import { buttonVariants } from "@/components/ui/button"
import { SubmitButton } from "@/components/ui/submit-button"

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

const submit = buttonVariants({
  variant: "outline",
  size: "sm",
  className: "self-start",
})
/**
 * The one control on a card that a reader came to press.
 *
 * Every action used to be the same small outline button, so activating a
 * repository, disabling it and requesting a different one all looked equally
 * likely to be what you wanted. Weight is the only thing distinguishing them
 * now: the step that moves the repository forward is `primary`, and everything
 * else stays `outline` and quiet.
 */
const primaryAction = buttonVariants({ className: "self-start" , variant: "primary" })
/** What pressing it does, under the control rather than buried above it. */
const consequence = "text-xs text-ink-secondary"
const field =
  "border-input bg-card text-foreground h-9 rounded-lg border px-3 text-sm outline-none hover:border-line-strong focus-visible:border-ring"

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
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-panel"
    >
      <h2 className="text-sm font-semibold text-foreground">
        Activate this repository
      </h2>
      {/* REPO-002 fixes this wording. It is requirement text, not invented copy. */}
      <p className="text-sm text-ink-secondary">Evirion will be allowed to:</p>
      <ul className="list-disc pl-5 text-sm text-ink-secondary">
        <li>process future merged pull requests;</li>
        <li>prepare historical pull requests;</li>
        <li>run approved model extraction;</li>
        <li>retain usage for this repository.</li>
      </ul>
      <p className="text-sm text-ink-secondary">
        {policyTerm("operational-authorization").meaning}
      </p>
      <Hidden
        repositoryId={repository.id}
        idempotencyKey={idempotencyKeys["activate"] ?? ""}
        expectedVersion={repository.entitlement?.version ?? null}
        csrfToken={csrfToken}
      />
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="confirmationAccepted" />I confirm this
      </label>
      <SubmitButton className={primaryAction}>Activate repository</SubmitButton>
      <p className={consequence}>
        Evirion starts watching this repository. Nothing is read from its history
        until you ask for that separately, and no model is called until you allow
        it.
      </p>
    </form>
  )

/**
 * The way into historical import.
 *
 * The page existed at `/repositories/<id>/import` and nothing linked to it, so
 * the only way to reach it was to know the URL and type it. That made the one
 * feature answering "what about the pull requests we already collected?"
 * invisible to the person who would ask.
 */
export const ImportEntry = ({ repository, controls }: ActionContext) =>
  !controls.canImport ? null : (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-panel">
      <h2 className="text-sm font-semibold text-foreground">
        Import this repository&rsquo;s history
      </h2>
      <a
        href={`/repositories/${repository.id}/import`}
        className={buttonVariants({ variant: "secondary", className: "self-start" })}
      >
        Open historical import
      </a>
      <p className={consequence}>
        Live processing only ever looks at pull requests merged from now on. An
        import is how everything merged earlier gets read, including anything
        collected while extraction was switched off. You choose the range, see how
        many pull requests it found and set a spending limit before anything is
        charged.
      </p>
    </section>
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
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-panel"
    >
      <h2 className="text-sm font-semibold text-foreground">Disable this repository</h2>
      <p className="text-sm text-ink-secondary">
        New work stops. Everything already recorded for this repository is kept, and
        disabling does not delete history or usage.
      </p>
      <Hidden
        repositoryId={repository.id}
        idempotencyKey={idempotencyKeys["disable"] ?? ""}
        expectedVersion={repository.entitlement?.version ?? null}
        csrfToken={csrfToken}
      />
      <label className="flex flex-col gap-1 text-sm text-foreground">
        Reason, optional
        <input type="text" name="reason" maxLength={500} className={field} />
      </label>
      <SubmitButton className={submit}>Disable repository</SubmitButton>
    </form>
  )

export const RequestChangeForm = ({
  repository,
  controls,
  csrfToken,
  idempotencyKeys,
  candidates,
  candidatesTruncated,
}: ActionContext & {
  readonly candidates: readonly Repository[]
  readonly candidatesTruncated: boolean
}) =>
  !controls.canRequestChange || candidates.length === 0 ? null : (
    <form
      action="/api/repositories/request-change"
      method="post"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-panel"
    >
      <h2 className="text-sm font-semibold text-foreground">
        Request a different repository
      </h2>
      <p className="text-sm text-ink-secondary">
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
      <label className="flex flex-col gap-1 text-sm text-foreground">
        Repository to use instead
        <select name="requestedRepositoryId" className={field}>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.nameWithOwner}
            </option>
          ))}
        </select>
      </label>
      {/* A partial list is said to be partial. Offering the first hundred as
          though they were all of them is the same defect as rendering an
          unavailable count as zero. */}
      {candidatesTruncated ? (
        <p className="text-xs text-ink-secondary">
          This lists the first hundred accessible repositories. If the one you want is
          missing, say so in the reason and an operator will find it.
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm text-foreground">
        Reason, optional
        <input type="text" name="reason" maxLength={500} className={field} />
      </label>
      <SubmitButton className={submit}>Request change</SubmitButton>
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
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-panel"
    >
      <h2 className="text-sm font-semibold text-foreground">Live processing</h2>
      <p className="text-sm text-ink-secondary">{policyTerm("source-work").meaning}</p>
      <Hidden
        repositoryId={repository.id}
        idempotencyKey={idempotencyKeys["policy"] ?? ""}
        expectedVersion={repository.policy?.version ?? null}
        csrfToken={csrfToken}
      />
      <label className="flex flex-col gap-1 text-sm text-foreground">
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
      <SubmitButton className={submit}>Save live processing</SubmitButton>
    </form>
  )

/**
 * The consent form, and the two reasons it may not appear.
 *
 * Without the capability there is nothing to offer. Without a readable
 * catalogue there is nothing safe to offer: falling back to free text would
 * restore the state where a typo and an unavailable model look identical, which
 * is the defect this surface exists to remove. An organization offered nothing
 * is a third case, and it is a fact rather than a failure.
 */
export const ConsentForm = ({
  repository,
  controls,
  csrfToken,
  idempotencyKeys,
  modelProfiles,
}: ActionContext & { readonly modelProfiles: ModelProfileCatalogueView }) => {
  if (!controls.canChangePolicy) return null

  if (modelProfiles.status === "unavailable") {
    return (
      <section
        aria-label="Turn on automatic extraction"
        className="rounded-2xl border border-border bg-muted px-5 py-4"
      >
        <h2 className="text-sm font-semibold text-foreground">
          Turn on automatic extraction
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          The model profiles this organization may consent to cannot be read right now,
          so this cannot be recorded. {modelProfiles.failure.message} Nothing has
          changed, and any existing consent is unaffected.
        </p>
      </section>
    )
  }

  const choices = offeredProfiles(modelProfiles.catalogue)
  const consented = new Set(repository.effectiveConsent?.allowedModelProfiles ?? [])

  if (choices.length === 0) {
    return (
      <section
        aria-label="Turn on automatic extraction"
        className="rounded-2xl border border-border bg-muted px-5 py-4"
      >
        <h2 className="text-sm font-semibold text-foreground">
          Turn on automatic extraction
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          No model profiles are currently offered to this organization, so there is
          nothing to consent to. Evirion decides which profiles are offered.
        </p>
      </section>
    )
  }

  return (
    <details className="rounded-2xl border border-border bg-card px-5 py-4 shadow-panel">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Turn on automatic extraction
      </summary>
      <form
        action="/api/repositories/policy"
        method="post"
        className="mt-3 flex flex-col gap-3"
      >
        <p className="text-sm text-ink-secondary">
          {policyTerm("customer-consent").meaning}
        </p>
        <p className="text-sm text-ink-secondary">
          {policyTerm("operational-authorization").meaning}
        </p>
        <Hidden
          repositoryId={repository.id}
          idempotencyKey={idempotencyKeys["consent"] ?? ""}
          expectedVersion={repository.policy?.version ?? null}
          csrfToken={csrfToken}
        />
        <input type="hidden" name="mode" value="AUTO_EXTRACT" />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-foreground">Model profiles</legend>
          {/* The value posted is the registry's canonical identifier, which is
              the exact string the worker presents at the paid boundary. The
              label is for the reader; only this value is ever submitted. */}
          {choices.map((choice) => (
            <label
              key={choice.canonicalIdentifier}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <input
                type="checkbox"
                name="allowedModelProfiles"
                value={choice.canonicalIdentifier}
                defaultChecked={consented.has(choice.canonicalIdentifier)}
              />
              <span>
                {choice.label}
                {choice.offeringState === "DEPRECATED" ? (
                  <span className="ml-2 text-xs text-ink-secondary">
                    deprecated, still offered
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1 text-sm text-foreground">
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
        <label className="flex flex-col gap-1 text-sm text-foreground">
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
        <label className="flex flex-col gap-1 text-sm text-foreground">
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
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Expires
          <input type="datetime-local" name="expiresAt" required className={field} />
        </label>
        <SubmitButton className={submit}>
          Record consent and turn on automatic extraction
        </SubmitButton>
      </form>
    </details>
  )
}

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
    <p className="rounded-2xl border border-border bg-muted px-5 py-4 text-sm text-ink-secondary">
      Evirion manages this organization&rsquo;s repository allowance, so activating a
      replacement is an operator action rather than something to do here.
    </p>
  )
