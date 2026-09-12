import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { formatInstant } from "@/lib/format/display"
import {
  correctionStatusLabel,
  correctionStatusTone,
  lifecycleStateLabel,
} from "@/lib/knowledge/presentation"
import type { KnowledgeCorrectionsView } from "@/server/queries/knowledge"
import { panelVariants } from "@/components/ui/panel"
import { StatusChip } from "@/components/ui/status-chip"
import { kickerClasses, SectionTitle, Technical } from "@/components/ui/text"

/**
 * The correction requests this Knowledge Object carries.
 *
 * The customer creates and reads a request. Executing, declining and retrying
 * one are operator commands on a separate non-browser surface, so no control
 * appears here at all: this is a status list, not an action list.
 *
 * A failed request shows a bounded support status. The published failure code
 * is shown so it can be quoted to support; nothing names the operator, their
 * internal rationale, or any detail beyond what the contract publishes.
 */

export const CorrectionRequests = ({ view }: { view: KnowledgeCorrectionsView }) => {
  if (view.status === "unavailable") {
    return (
      <ConsoleUnavailable
        failure={view.failure}
        heading="The correction requests are not available right now"
      />
    )
  }

  const requests = view.corrections.correctionRequests
  if (requests.length === 0) return null

  return (
    <section
      aria-label="Correction requests"
      data-testid="correction-requests"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <SectionTitle>Correction requests</SectionTitle>
        <p className="text-muted-foreground max-w-[68ch] text-xs leading-5">
          Requests you have sent to Evirion. Evirion applies or declines each one; there
          is nothing to do here while one is in progress.
        </p>
      </div>

      <ol aria-label="Requests" className="flex flex-col gap-3">
        {requests.map((request) => (
          <li
            key={request.correctionRequestId}
            data-testid="correction-request"
            data-status={request.status}
            className={panelVariants({ className: "flex flex-col gap-3" })}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusChip tone={correctionStatusTone(request.status)}>
                {correctionStatusLabel(request.status)}
              </StatusChip>
              <Technical>Requested {formatInstant(request.requestedAt)}</Technical>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className={kickerClasses()}>Requested change</dt>
                <dd className="text-ink-secondary text-xs">{request.requestType}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className={kickerClasses()}>Reason</dt>
                <dd className="text-ink-secondary text-xs">{request.reasonCode}</dd>
              </div>
              {request.compensatingLifecycleState === undefined ? null : (
                <div className="flex flex-col gap-1">
                  <dt className={kickerClasses()}>Resulting lifecycle</dt>
                  <dd className="text-ink-secondary text-xs">
                    {lifecycleStateLabel(request.compensatingLifecycleState)}
                  </dd>
                </div>
              )}
              {request.status === "FAILED" ? (
                <div className="flex flex-col gap-1">
                  <dt className={kickerClasses()}>What to do</dt>
                  <dd className="text-ink-secondary text-xs leading-5">
                    {/* Bounded: a published code to quote, and no operator
                        internal. There is no customer retry, because retrying
                        is an Evirion operation. */}
                    Contact Evirion support and quote{" "}
                    <code>{request.failureCode ?? "this request"}</code>. Evirion
                    resumes it; there is nothing to retry here.
                  </dd>
                </div>
              ) : null}
            </dl>

            {request.note === undefined ? null : (
              <p className="text-ink-secondary text-xs leading-5">
                Your note: {request.note}
              </p>
            )}

            <details className="border-border border-t pt-3">
              <summary className="text-ink-secondary hover:text-foreground cursor-pointer text-xs font-medium">
                Request history
              </summary>
              <ol
                aria-label="Request history"
                className="text-muted-foreground mt-2 flex flex-col gap-1 font-mono text-xs"
              >
                {request.history.map((entry) => (
                  <li
                    key={`${entry.toStatus}-${entry.requestVersion}`}
                    data-testid="correction-history-entry"
                  >
                    {correctionStatusLabel(entry.toStatus)} on{" "}
                    {formatInstant(entry.recordedAt)}
                    {/* Who moved it, in the two kinds the contract publishes.
                        Never which operator. */}
                    {entry.actorKind === "customer" ? " by you" : " by Evirion"}
                    {entry.reason === undefined ? "" : `. ${entry.reason}`}
                  </li>
                ))}
              </ol>
            </details>
          </li>
        ))}
      </ol>
    </section>
  )
}
