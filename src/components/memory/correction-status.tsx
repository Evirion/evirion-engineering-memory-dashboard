import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  correctionStatusLabel,
  lifecycleStateLabel,
} from "@/lib/knowledge/presentation"
import type { KnowledgeCorrectionsView } from "@/server/queries/knowledge"

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

const term = "text-xs font-medium tracking-wide text-slate-500 uppercase"

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
        <h2 className="text-sm font-semibold text-slate-900">Correction requests</h2>
        <p className="text-xs text-slate-600">
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
            className="flex flex-col gap-2 rounded border border-slate-300 bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-slate-900">
                {correctionStatusLabel(request.status)}
              </span>
              <span className="text-xs text-slate-600">
                Requested {request.requestedAt.slice(0, 10)}
              </span>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className={term}>Requested change</dt>
                <dd className="text-xs text-slate-700">{request.requestType}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className={term}>Reason</dt>
                <dd className="text-xs text-slate-700">{request.reasonCode}</dd>
              </div>
              {request.compensatingLifecycleState === undefined ? null : (
                <div className="flex flex-col gap-1">
                  <dt className={term}>Resulting lifecycle</dt>
                  <dd className="text-xs text-slate-700">
                    {lifecycleStateLabel(request.compensatingLifecycleState)}
                  </dd>
                </div>
              )}
              {request.status === "FAILED" ? (
                <div className="flex flex-col gap-1">
                  <dt className={term}>What to do</dt>
                  <dd className="text-xs text-slate-700">
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
              <p className="text-xs text-slate-700">Your note: {request.note}</p>
            )}

            <details>
              <summary className="cursor-pointer text-xs font-medium text-slate-900">
                Request history
              </summary>
              <ol
                aria-label="Request history"
                className="mt-2 flex flex-col gap-1 text-xs text-slate-700"
              >
                {request.history.map((entry) => (
                  <li
                    key={`${entry.toStatus}-${entry.requestVersion}`}
                    data-testid="correction-history-entry"
                  >
                    {correctionStatusLabel(entry.toStatus)} on{" "}
                    {entry.recordedAt.slice(0, 10)}
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
