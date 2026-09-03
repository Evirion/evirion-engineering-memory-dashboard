import type { Repository, RepositoryImport } from "@contracts/console"

import type { ImportControls } from "@/lib/imports/presentation"
import {
  authorizationView,
  recoveryActionLabel,
  retryBlockerLabel,
} from "@/lib/imports/presentation"
import type { ImportFailuresView } from "@/server/queries/imports"

/**
 * The import controls.
 *
 * Three rules hold across all of them. The idempotency key is minted once when
 * the form is rendered, so a duplicate click sends the same key and receives
 * the stored receipt rather than a second command. The optimistic token is the
 * status the backend last reported and is forwarded unchanged. And no control
 * claims success: the page re-reads the import after the redirect, so what is
 * shown afterwards is the committed projection.
 *
 * Which controls exist is decided by the backend `capabilities` projection and,
 * for a single failed job, by that failure's own `retryable`. There is no
 * generic Retry here; `/processing` owns that and `EEM-9/06` owns `/processing`.
 */

export type ImportActionContext = {
  readonly repository: Repository
  readonly current: RepositoryImport | null
  readonly controls: ImportControls
  readonly csrfToken: string
  /** One per rendered form, so a double submit cannot become two commands. */
  readonly idempotencyKeys: Readonly<Record<string, string>>
}

const submit =
  "rounded border border-slate-400 px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
const field = "rounded border border-slate-300 px-2 py-1 text-sm"
const card = "flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"

const Hidden = ({
  repositoryId,
  idempotencyKey,
  csrfToken,
}: {
  repositoryId: string
  idempotencyKey: string
  csrfToken: string
}) => (
  <>
    <input type="hidden" name="csrfToken" value={csrfToken} />
    <input type="hidden" name="repositoryId" value={repositoryId} />
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
  </>
)

const ImportIdentity = ({ current }: { current: RepositoryImport }) => (
  <>
    <input type="hidden" name="importId" value={current.importId} />
    {/* `core.backfill_runs` carries no version column, so the optimistic token
        is the status the customer was shown. A stale one conflicts exactly as a
        stale version does. */}
    <input type="hidden" name="expectedStatus" value={current.status} />
  </>
)

/**
 * Prepare an import.
 *
 * Offered only for an actively entitled repository, and only when no run is
 * already current: the backend refuses a second one with
 * `REPOSITORY_IMPORT_ALREADY_ACTIVE`, and offering a control that cannot
 * succeed is what the capability rule exists to prevent.
 *
 * Discovery and source preparation are free. Nothing on this form authorizes a
 * model call, and the form says so rather than leaving it to be assumed.
 */
export const PrepareForm = ({
  repository,
  controls,
  csrfToken,
  idempotencyKeys,
}: ImportActionContext) => {
  if (!controls.canPrepare) return null

  return (
    <form
      action="/api/imports/prepare"
      method="post"
      data-testid="import-prepare"
      className={card}
    >
      <h2 className="text-sm font-semibold text-slate-900">Prepare import</h2>
      <p className="text-sm text-slate-700">
        Evirion reads the merged pull requests it does not already hold and prepares
        them as source work. Discovery and preparation make no model call and cost
        nothing.
      </p>
      <Hidden
        repositoryId={repository.id}
        idempotencyKey={idempotencyKeys["prepare"] ?? ""}
        csrfToken={csrfToken}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-900">Range</legend>
        <label className="flex items-center gap-2 text-sm text-slate-900">
          <input type="radio" name="range" value="ENTIRE_HISTORY" defaultChecked />
          Entire repository history
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-900">
          <input type="radio" name="range" value="LAST_12_MONTHS" />
          Last 12 months
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-900">
          <input type="radio" name="range" value="CUSTOM" />
          Custom date range
        </label>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm text-slate-900">
        Merged from
        <input type="date" name="mergedFrom" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-900">
        Merged to
        <input type="date" name="mergedTo" className={field} />
      </label>
      <p className="text-xs text-slate-600">
        Both dates are required for a custom range and are inclusive.
      </p>
      <button type="submit" className={submit}>
        Prepare import
      </button>
    </form>
  )
}

/**
 * Approve paid extraction.
 *
 * Rendered only when the backend permits it. The copy names what this is and
 * what it is not: it records the customer's consent, and Evirion operational
 * authorization remains a separate gate that no customer action can satisfy.
 */
export const ApproveForm = ({
  repository,
  current,
  controls,
  csrfToken,
  idempotencyKeys,
}: ImportActionContext) => {
  if (current === null || !controls.canApprove) return null
  const view = authorizationView(current.paidAuthorizationStatus)

  return (
    <form
      action="/api/imports/approve"
      method="post"
      data-testid="import-approve"
      className={card}
    >
      <h2 className="text-sm font-semibold text-slate-900">
        {view.customerAction === "re-request"
          ? "Request extraction again"
          : "Approve extraction"}
      </h2>
      <p className="text-sm text-slate-700">
        This authorizes paid model calls for the work discovered above. Extraction uses
        a model provider and is charged against the budget you set here.
      </p>
      <p className="text-sm text-slate-700">
        Approving records your consent. It does not grant Evirion operational
        authorization, which is a separate gate only Evirion can open, so this import
        may still wait afterwards.
      </p>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Repository</dt>
          <dd className="text-slate-700">{repository.nameWithOwner}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Eligible pull requests</dt>
          <dd className="text-slate-700">{current.counts.discovered}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Already processed</dt>
          <dd className="text-slate-700">{current.counts.completed}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Prepared source envelopes</dt>
          <dd className="text-slate-700">{current.counts.sourceReady}</dd>
        </div>
      </dl>
      <Hidden
        repositoryId={repository.id}
        idempotencyKey={idempotencyKeys["approve"] ?? ""}
        csrfToken={csrfToken}
      />
      <ImportIdentity current={current} />
      <label className="flex flex-col gap-1 text-sm text-slate-900">
        Cost budget in USD
        <input
          type="number"
          name="costBudgetUsd"
          min="0.000001"
          step="0.000001"
          className={field}
        />
      </label>
      <button type="submit" className={submit}>
        Approve extraction
      </button>
    </form>
  )
}

/**
 * Pause, resume and cancel.
 *
 * Each is drawn only when the backend `capabilities` projection permits it,
 * which is why the status is not consulted here. A resume the backend forces
 * back to paused is a completed command, not a failure, and the outcome notice
 * reports it as itself.
 */
export const RunStateForms = ({
  repository,
  current,
  controls,
  csrfToken,
  idempotencyKeys,
}: ImportActionContext) => {
  if (current === null) return null

  const offered = [
    {
      state: "PAUSED",
      key: "pause",
      permitted: controls.canPause,
      label: "Pause import",
      detail: "Stops claiming new work. Work already in flight finishes.",
    },
    {
      state: "RESUMED",
      key: "resume",
      permitted: controls.canResume,
      label: "Resume import",
      detail:
        "Continues from where it stopped. If source work is still held back, the backend keeps it paused and says so.",
    },
    {
      state: "CANCELLED",
      key: "cancel",
      permitted: controls.canCancel,
      label: "Cancel import",
      detail: "Ends this run. Everything already recorded is kept.",
    },
  ].filter((control) => control.permitted)

  if (offered.length === 0) return null

  return (
    <div data-testid="import-run-controls" className="flex flex-col gap-3">
      {offered.map((control) => (
        <form
          key={control.state}
          action="/api/imports/state"
          method="post"
          className={card}
        >
          <h2 className="text-sm font-semibold text-slate-900">{control.label}</h2>
          <p className="text-sm text-slate-700">{control.detail}</p>
          <Hidden
            repositoryId={repository.id}
            idempotencyKey={idempotencyKeys[control.key] ?? ""}
            csrfToken={csrfToken}
          />
          <ImportIdentity current={current} />
          <input type="hidden" name="state" value={control.state} />
          <button type="submit" className={submit}>
            {control.label}
          </button>
        </form>
      ))}
    </div>
  )
}

/**
 * Failed work, and the recovery the backend declared for it.
 *
 * A retry control exists only where the projection sets `retryable`. Where it
 * does not, the blocker is stated instead, and no control is drawn. Nothing
 * here derives retryability from a status, an error code or a count.
 *
 * An unavailable failures read is reported as unavailable. Rendering an empty
 * list would claim there is nothing to recover, which is a different statement
 * from not knowing.
 */
export const ImportFailureList = ({
  repository,
  current,
  controls,
  csrfToken,
  idempotencyKeys,
  failures,
}: ImportActionContext & { readonly failures: ImportFailuresView }) => {
  if (current === null) return null
  if (failures.status === "not-applicable") return null

  if (failures.status === "unavailable") {
    return (
      <section
        aria-labelledby="import-failures-heading"
        data-testid="import-failures-unavailable"
        className={card}
      >
        <h2
          id="import-failures-heading"
          className="text-sm font-semibold text-slate-900"
        >
          Failed work
        </h2>
        <p className="text-sm text-slate-700">
          The list of failed work could not be read, so it is not shown. This does not
          mean there is none: {current.counts.failed} failed.
        </p>
        <p className="text-xs text-slate-600">
          Reason <code>{failures.failure.code}</code>
        </p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="import-failures-heading"
      data-testid="import-failures"
      className={card}
    >
      <h2 id="import-failures-heading" className="text-sm font-semibold text-slate-900">
        Failed work
      </h2>
      <p className="text-sm text-slate-700">
        These did not finish. Recovery is offered only where the backend has declared
        the work retryable.
      </p>
      <ul className="flex flex-col gap-3">
        {failures.failures.failures.map((failure) => {
          const blocker = retryBlockerLabel(failure.retryBlocker)
          const recovery = recoveryActionLabel(failure.recoveryAction)

          return (
            <li
              key={failure.itemId}
              data-testid="import-failure"
              data-retryable={failure.retryable ? "yes" : "no"}
              className="flex flex-col gap-2 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0"
            >
              <dl className="flex flex-col gap-1 text-sm">
                <div className="flex flex-wrap gap-2">
                  <dt className="font-medium text-slate-900">Pull request</dt>
                  <dd className="text-slate-700">
                    {failure.pullRequestNumber === null
                      ? "Not recorded"
                      : `#${failure.pullRequestNumber}`}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-2">
                  <dt className="font-medium text-slate-900">Reason</dt>
                  <dd className="text-slate-700">
                    {failure.lastErrorCode ?? "Not recorded"}
                  </dd>
                </div>
              </dl>
              {recovery ? <p className="text-sm text-slate-700">{recovery}</p> : null}
              {blocker ? <p className="text-sm text-slate-700">{blocker}</p> : null}
              {controls.canRetry &&
              failure.retryable &&
              failure.extractionJobId !== null ? (
                <form action="/api/imports/retry" method="post">
                  <Hidden
                    repositoryId={repository.id}
                    idempotencyKey={idempotencyKeys[`retry:${failure.itemId}`] ?? ""}
                    csrfToken={csrfToken}
                  />
                  <input type="hidden" name="importId" value={current.importId} />
                  <input
                    type="hidden"
                    name="extractionJobId"
                    value={failure.extractionJobId}
                  />
                  <button type="submit" className={submit}>
                    Retry this work
                  </button>
                </form>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
