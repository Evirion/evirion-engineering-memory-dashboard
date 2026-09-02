import type { ViewFailure } from "@/server/queries/repositories"

/**
 * Every state a page can be in other than showing data.
 *
 * Forbidden, not-found, stale, retryable, non-retryable and unknown all arrive
 * here as one published stable code with a treatment the backend's own
 * retryability decided. Nothing is inferred locally, and an unrecognised
 * document reaches this as an explicit unknown rather than as a blank page.
 */
export const ConsoleUnavailable = ({
  failure,
  heading,
}: {
  failure: ViewFailure
  heading: string
}) => (
  <section
    aria-labelledby="console-unavailable-heading"
    className="flex flex-col gap-3 rounded border border-slate-300 bg-slate-50 px-4 py-3"
  >
    <h2
      id="console-unavailable-heading"
      className="text-sm font-semibold text-slate-900"
    >
      {heading}
    </h2>
    <p className="text-sm text-slate-700">{failure.message}</p>
    <dl className="flex flex-col gap-1 text-xs text-slate-600">
      <div className="flex gap-2">
        <dt className="font-medium">Reason</dt>
        <dd>{failure.code}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="font-medium">Can this be retried</dt>
        {/* The backend declares retryability. The UI never derives it. */}
        <dd>{failure.retryable ? "Yes, shortly" : "No, not by retrying"}</dd>
      </div>
      {failure.requestId ? (
        <div className="flex gap-2">
          <dt className="font-medium">Reference</dt>
          <dd>
            <code>{failure.requestId}</code>
          </dd>
        </div>
      ) : null}
    </dl>
  </section>
)
