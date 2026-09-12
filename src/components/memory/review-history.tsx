import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { formatInstant } from "@/lib/format/display"
import {
  lifecycleStateLabel,
  reviewActionLabel,
  reviewActionTone,
} from "@/lib/knowledge/presentation"
import type { KnowledgeHistoryView } from "@/server/queries/knowledge"
import { panelVariants } from "@/components/ui/panel"
import { StatusChip } from "@/components/ui/status-chip"
import { SectionTitle, Technical } from "@/components/ui/text"

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
        <SectionTitle>Review history</SectionTitle>
        <p className="text-muted-foreground max-w-[68ch] text-xs leading-5">
          Every decision is kept. A later decision is appended beside the earlier ones
          and never replaces one.
        </p>
      </div>

      {reviews.length === 0 ? (
        <p
          data-testid="review-history-empty"
          className="border-line-default text-ink-secondary rounded-2xl border border-dashed px-5 py-6 text-sm"
        >
          No one has reviewed this Knowledge Object yet.
        </p>
      ) : (
        /*
          A timeline, drawn with a rule rather than boxes. The history is
          append-only, so it is presented as a sequence of things that
          happened, and there is no delete or amend affordance to render
          because neither exists.
        */
        <ol
          aria-label="Recorded review decisions"
          className="border-border flex flex-col gap-3 border-l pl-5"
        >
          {reviews.map((review) => (
            <li
              key={review.reviewId}
              data-testid="review-history-entry"
              className={panelVariants({
                padding: "compact",
                className: "relative flex flex-col gap-2",
              })}
            >
              <span
                aria-hidden
                className="bg-border absolute top-6 -left-[23px] size-2 rounded-full ring-4 ring-[var(--background)]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusChip tone={reviewActionTone(review.action)}>
                  {reviewActionLabel(review.action)}
                </StatusChip>
                <Technical>
                  Sequence {review.reviewSequence} on {formatInstant(review.recordedAt)}
                </Technical>
              </div>
              <p className="text-ink-secondary text-xs leading-5">
                Recorded by a {review.reviewerRole} while the lifecycle was{" "}
                {lifecycleStateLabel(review.observedLifecycleState).toLowerCase()}.
              </p>
              {review.rejectReasonCode === undefined ? null : (
                <Technical>
                  Reason {review.rejectReasonCode}
                  {review.issueSeverity === undefined
                    ? ""
                    : `, severity ${review.issueSeverity}`}
                </Technical>
              )}
              {review.note === undefined ? null : (
                <p className="text-ink-secondary text-xs leading-5">
                  Note: {review.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
