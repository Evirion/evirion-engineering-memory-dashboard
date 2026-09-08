import type { RepositoryImport } from "@contracts/console"

import {
  authorizationTone,
  authorizationView,
  importStatusTone,
  missingPrerequisiteLabel,
  missingPrerequisiteTone,
  recoveryActionLabel,
  recoveryActionTone,
  statusLabel,
  terminationReasonLabel,
  terminationReasonTone,
} from "@/lib/imports/presentation"
import { noticeClasses, panelVariants } from "@/components/ui/panel"
import { StatusChip } from "@/components/ui/status-chip"
import { kickerClasses, SectionTitle, Technical } from "@/components/ui/text"

/**
 * Where one import stands, and who it is waiting on.
 *
 * The run status and the authorization status are two separate axes and are
 * rendered as two. A run can be `PROCESSING` while authorization is still
 * pending, and `BF-002` is explicit that the primary label in that case is the
 * wait rather than the activity, so the wait is stated first and the run status
 * is stated as its own labelled fact.
 */

/**
 * The two waits, told apart by treatment and not only by wording.
 *
 * Four independent signals separate them, so losing any one still leaves
 * three: the tone, the chip glyph, the 3px panel edge, and — the one that
 * matters most — whether a control exists at all. Waiting for the customer is
 * an open question with a control elsewhere on the page. Waiting for Evirion
 * is a resting state with no control anywhere, and it says so in words,
 * because the failure this guards against is a customer waiting for
 * themselves.
 */
export const AuthorizationPanel = ({ current }: { current: RepositoryImport }) => {
  const view = authorizationView(current.paidAuthorizationStatus)
  const prerequisite = missingPrerequisiteLabel(current.missingPrerequisite)
  const tone = authorizationTone(current.paidAuthorizationStatus)

  return (
    <section
      aria-labelledby="import-authorization-heading"
      data-testid="import-authorization"
      data-waiting-on={view.waitingOn}
      data-authorization-status={current.paidAuthorizationStatus}
      className={noticeClasses(tone, "flex flex-col gap-3")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="import-authorization-heading" className={kickerClasses()}>
          Paid extraction
        </h2>
        <StatusChip tone={tone}>{view.label}</StatusChip>
      </div>

      <dl className="flex flex-wrap gap-x-2 text-sm">
        <dt className="font-medium">Waiting on</dt>
        {/* Text, never colour alone, and never a shared spinner. */}
        <dd>
          {view.waitingOn === "customer"
            ? "You"
            : view.waitingOn === "evirion"
              ? "Evirion"
              : "Nobody"}
        </dd>
      </dl>

      <p className="max-w-[68ch] text-sm leading-6">{view.detail}</p>

      {view.waitingOn === "evirion" ? (
        <p className="text-sm font-medium">
          There is no action for you to take on this, and approving again would not
          grant it.
        </p>
      ) : null}

      {prerequisite ? (
        <p
          className={noticeClasses(
            missingPrerequisiteTone(current.missingPrerequisite) ?? "neutral",
            "text-sm leading-6",
          )}
        >
          {prerequisite}
        </p>
      ) : null}
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
      className={panelVariants({ className: "flex flex-col gap-4" })}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle id="import-status-heading">
          {statusLabel(current.status)}
        </SectionTitle>
        <StatusChip tone={importStatusTone(current.status)}>
          {statusLabel(current.status)}
        </StatusChip>
      </div>

      <dl className="border-border grid gap-4 sm:grid-cols-2 sm:gap-x-6">
        <div className="flex flex-col gap-0.5">
          <dt className={kickerClasses()}>Scope</dt>
          {/* The customer API fixes the mode; it is shown, never chosen. */}
          <dd className="text-ink-secondary text-sm">Pull requests not already held</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className={kickerClasses()}>Window</dt>
          <dd className="text-ink-secondary text-sm">
            {current.filters.mergedFrom === undefined &&
            current.filters.mergedTo === undefined
              ? "Entire history"
              : `${current.filters.mergedFrom ?? "The beginning"} to ${
                  current.filters.mergedTo ?? "now"
                }`}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className={kickerClasses()}>Progress up to</dt>
          <dd>
            <Technical>{current.highWatermark}</Technical>
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className={kickerClasses()}>Run reference</dt>
          <dd>
            <Technical>
              <code>{current.importId}</code>
            </Technical>
          </dd>
        </div>
      </dl>

      {termination ? (
        <p
          className={noticeClasses(
            terminationReasonTone(current.terminationReasonCategory) ?? "neutral",
            "text-sm leading-6",
          )}
        >
          {termination}
        </p>
      ) : null}
      {recovery ? (
        <p
          data-testid="import-recovery"
          className={noticeClasses(
            recoveryActionTone(current.recoveryAction) ?? "neutral",
            "text-sm leading-6",
          )}
        >
          {recovery}
        </p>
      ) : null}
    </section>
  )
}
