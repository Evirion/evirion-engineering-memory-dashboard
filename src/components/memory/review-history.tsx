import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { lifecycleStateLabel, reviewActionLabel } from "@/lib/knowledge/presentation"
import type { KnowledgeHistoryView } from "@/server/queries/knowledge"

/**
 * Every review decision ever recorded against one Knowledge Object.
 *
 * The history is append-only, so it renders as a timeline rather than an
 * editable log: there is no delete and no amend, and none is offered. The
 * ordering is the backend's own monotonic sequence rather than a timestamp,
 * because the effective decision is selected by sequence and a client-side
 * re-sort could disagree with the projection.
 *
 * `PENDING` is sequence zero. An object with no review has an empty timeline,
 * which is a derived state and not an unknown one.
 */
export const ReviewHistory = ({ view }: { view: KnowledgeHistoryView }) => {
  if (view.status === "unavailable") {
    return (
      <ConsoleUnavailable
        failure={view.failure}
        heading="The review history is not available right now"
      />
    )
  }

  const reviews = view.history.reviews

  return (
    <section
      aria-label="Review history"
      data-testid="review-history"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-slate-900">Review history</h2>
        <p className="text-xs text-slate-600">
          Every decision is kept. A later decision is appended beside the earlier ones
          and never replaces one.
        </p>
      </div>

      {reviews.length === 0 ? (
        <p
          data-testid="review-history-empty"
          className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          No one has reviewed this Knowledge Object yet.
        </p>
      ) : (
        <ol aria-label="Recorded review decisions" className="flex flex-col gap-2">
          {reviews.map((review) => (
            <li
              key={review.reviewId}
              data-testid="review-history-entry"
              className="flex flex-col gap-1 rounded border border-slate-300 bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {reviewActionLabel(review.action)}
                </span>
                <span className="text-xs text-slate-600">
                  Sequence {review.reviewSequence} on {review.recordedAt.slice(0, 10)}
                </span>
              </div>
              <p className="text-xs text-slate-700">
                Recorded by a {review.reviewerRole} while the lifecycle was{" "}
                {lifecycleStateLabel(review.observedLifecycleState).toLowerCase()}.
              </p>
              {review.rejectReasonCode === undefined ? null : (
                <p className="text-xs text-slate-700">
                  Reason {review.rejectReasonCode}
                  {review.issueSeverity === undefined
                    ? ""
                    : `, severity ${review.issueSeverity}`}
                </p>
              )}
              {review.note === undefined ? null : (
                <p className="text-xs text-slate-700">Note: {review.note}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
