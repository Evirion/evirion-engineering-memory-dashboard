import type { RepositoryImport } from "@contracts/console"

import {
  authorizationView,
  missingPrerequisiteLabel,
  recoveryActionLabel,
  statusLabel,
  terminationReasonLabel,
} from "@/lib/imports/presentation"

/**
 * Where one import stands, and who it is waiting on.
 *
 * The run status and the authorization status are two separate axes and are
 * rendered as two. A run can be `PROCESSING` while authorization is still
 * pending, and `BF-002` is explicit that the primary label in that case is the
 * wait rather than the activity, so the wait is stated first and the run status
 * is stated as its own labelled fact.
 */

const card = "flex flex-col gap-2 rounded border border-slate-300 bg-white px-4 py-3"

/**
 * The two waits, told apart by treatment and not only by wording.
 *
 * Waiting for the customer is an open question with a control elsewhere on the
 * page. Waiting for Evirion is a resting state with no control anywhere, and it
 * carries an explicit statement that there is nothing to do, because the whole
 * failure mode this guards against is a customer waiting for themselves.
 */
export const AuthorizationPanel = ({ current }: { current: RepositoryImport }) => {
  const view = authorizationView(current.paidAuthorizationStatus)
  const prerequisite = missingPrerequisiteLabel(current.missingPrerequisite)

  return (
    <section
      aria-labelledby="import-authorization-heading"
      data-testid="import-authorization"
      data-waiting-on={view.waitingOn}
      data-authorization-status={current.paidAuthorizationStatus}
      className={card}
    >
      <h2
        id="import-authorization-heading"
        className="text-sm font-semibold text-slate-900"
      >
        Paid extraction
      </h2>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Authorization</dt>
          <dd className="text-slate-900">{view.label}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Waiting on</dt>
          {/* Text, never colour alone, and never a shared spinner. */}
          <dd className="text-slate-700">
            {view.waitingOn === "customer"
              ? "You"
              : view.waitingOn === "evirion"
                ? "Evirion"
                : "Nobody"}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-slate-700">{view.detail}</p>
      {view.waitingOn === "evirion" ? (
        <p className="text-sm font-medium text-slate-900">
          There is no action for you to take on this, and approving again would not
          grant it.
        </p>
      ) : null}
      {prerequisite ? <p className="text-sm text-slate-700">{prerequisite}</p> : null}
    </section>
  )
}

export const ImportStatusPanel = ({ current }: { current: RepositoryImport }) => {
  const termination = terminationReasonLabel(current.terminationReasonCategory)
  const recovery = recoveryActionLabel(current.recoveryAction)

  return (
    <section
      aria-labelledby="import-status-heading"
      data-testid="import-status"
      data-import-status={current.status}
      className={card}
    >
      <h2 id="import-status-heading" className="text-sm font-semibold text-slate-900">
        {statusLabel(current.status)}
      </h2>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Scope</dt>
          {/* The customer API fixes the mode; it is shown, never chosen. */}
          <dd className="text-slate-700">Pull requests not already held</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Window</dt>
          <dd className="text-slate-700">
            {current.filters.mergedFrom === undefined &&
            current.filters.mergedTo === undefined
              ? "Entire history"
              : `${current.filters.mergedFrom ?? "The beginning"} to ${
                  current.filters.mergedTo ?? "now"
                }`}
          </dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Progress up to</dt>
          <dd className="text-slate-700">{current.highWatermark}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Run reference</dt>
          <dd className="text-slate-700">
            <code>{current.importId}</code>
          </dd>
        </div>
      </dl>
      {termination ? <p className="text-sm text-slate-700">{termination}</p> : null}
      {recovery ? (
        <p data-testid="import-recovery" className="text-sm text-slate-700">
          {recovery}
        </p>
      ) : null}
    </section>
  )
}
