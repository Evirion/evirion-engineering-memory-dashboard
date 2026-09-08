import { CircleAlert } from "lucide-react"

import type { ViewFailure } from "@/lib/errors/console-errors"
import { noticeClasses } from "@/components/ui/panel"
import { kickerClasses } from "@/components/ui/text"

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
  /*
   * Page level rather than inline, because this is the document failing to be
   * built rather than one control refusing. The code and the reference are
   * shown rather than tucked away: they are what a customer quotes to support,
   * and a toast would take them off screen before they could be copied.
   */
  <section
    aria-labelledby="console-unavailable-heading"
    className={noticeClasses(
      failure.retryable ? "attention" : "rejected",
      "flex flex-col gap-3",
    )}
  >
    <h2
      id="console-unavailable-heading"
      className="flex items-center gap-2 text-base font-semibold tracking-tight"
    >
      <CircleAlert aria-hidden className="size-4 shrink-0" strokeWidth={2} />
      {heading}
    </h2>
    <p className="max-w-[68ch] text-sm leading-6">{failure.message}</p>
    <dl className="border-current/20 grid gap-2 border-t pt-3 font-mono text-xs sm:grid-cols-3">
      <div className="flex flex-col gap-0.5">
        <dt className={kickerClasses()}>Reason</dt>
        <dd>{failure.code}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className={kickerClasses()}>Can this be retried</dt>
        {/* The backend declares retryability. The UI never derives it. */}
        <dd>{failure.retryable ? "Yes, shortly" : "No, not by retrying"}</dd>
      </div>
      {failure.requestId ? (
        <div className="flex flex-col gap-0.5">
          <dt className={kickerClasses()}>Reference</dt>
          <dd>
            <code>{failure.requestId}</code>
          </dd>
        </div>
      ) : null}
    </dl>
  </section>
)
