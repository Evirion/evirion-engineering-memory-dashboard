import type { KnowledgePage } from "@contracts/console"

import { type KnowledgeFilters, knowledgeQueuePath } from "@/lib/knowledge/filters"
import { queueRow } from "@/lib/knowledge/presentation"
import { buttonVariants } from "@/components/ui/button"
import { panelVariants } from "@/components/ui/panel"
import { StatusChip } from "@/components/ui/status-chip"
import { Technical } from "@/components/ui/text"

/**
 * The review queue.
 *
 * The visual primitive is open decision 4. The structure below is what the
 * contract requires either way: one row per Knowledge Object carrying the
 * summary alone, review and lifecycle as two separately labelled states rather
 * than one status, and a cursor control that follows the backend's own
 * `nextCursor`. Tests assert accessible names and per-item state rather than
 * the element, so a later table or card decision invalidates no acceptance row.
 *
 * The rows carry no provenance. Evidence, the original payload and every
 * technical detail belong to the detail projection, so a list page never loads
 * them per row.
 */

const formatMerged = (mergedAt: string | null): string =>
  mergedAt === null ? "No merge date recorded" : `Merged ${mergedAt.slice(0, 10)}`

const formatPullRequest = (
  pullRequestNumber: number | null,
  pullRequestTitle: string | null,
): string => {
  // The three pull request fields are null for a Knowledge Object whose run
  // carries no job. That is a fact about the source, not a missing value, and
  // it never renders as a zero or an empty number.
  if (pullRequestNumber === null) return "No pull request recorded"
  return pullRequestTitle === null
    ? `Pull request #${pullRequestNumber}`
    : `Pull request #${pullRequestNumber}: ${pullRequestTitle}`
}

export const MemoryQueueList = ({ page }: { page: KnowledgePage }) => {
  if (page.items.length === 0) {
    // Dashed, so an empty result is never mistaken for one still loading.
    return (
      <p
        data-testid="memory-queue-empty"
        className="border-line-default text-ink-secondary rounded-2xl border border-dashed px-5 py-8 text-center text-sm"
      >
        No Knowledge Object matches these filters. Machine-rejected and quarantined
        extractions are never listed here.
      </p>
    )
  }

  return (
    <ul aria-label="Knowledge Objects" className="stagger flex flex-col gap-4">
      {page.items.map((summary) => {
        const row = queueRow(summary)
        return (
          <li
            key={row.knowledgeObjectId}
            data-testid="memory-queue-row"
            className={panelVariants({ className: "flex flex-col gap-3" })}
          >
            {/*
              The claim leads, at the largest size on the card. It is a
              sentence and the reason the row exists, so it is the link target
              and everything else is metadata beneath it.
            */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <a
                href={`/memory/${row.knowledgeObjectId}`}
                className="text-foreground hover:text-primary max-w-[64ch] text-base leading-6 font-medium"
              >
                {row.shortClaim}
              </a>
              <Technical className="bg-muted rounded-sm px-2 py-0.5 tracking-[0.06em] uppercase">
                {row.knowledgeType}
              </Technical>
            </div>

            {/* Review and lifecycle are two axes. Each keeps its own label so
                neither can be read as the other. */}
            <dl className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <dt className="sr-only">Review</dt>
              <dd>
                <StatusChip tone={row.reviewTone}>{row.reviewLabel}</StatusChip>
              </dd>
              <dt className="sr-only">Lifecycle</dt>
              <dd>
                <StatusChip tone={row.lifecycleTone}>{row.lifecycleLabel}</StatusChip>
              </dd>
            </dl>

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tabular-nums">
              <span>
                {formatPullRequest(row.pullRequestNumber, row.pullRequestTitle)}
              </span>
              <span aria-hidden>·</span>
              <span>{formatMerged(row.mergedAt)}</span>
              <span aria-hidden>·</span>
              <span>Model confidence {row.confidence} of 100</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export const MemoryQueuePagination = ({
  page,
  filters,
  repositoryId,
}: {
  page: KnowledgePage
  filters: KnowledgeFilters
  repositoryId?: string
}) =>
  page.page.nextCursor === null ? null : (
    <nav aria-label="Knowledge Object pages" className="flex justify-center">
      <a
        href={knowledgeQueuePath(
          { ...filters, after: page.page.nextCursor },
          { keepCursor: true, ...(repositoryId === undefined ? {} : { repositoryId }) },
        )}
        className={buttonVariants({ variant: "outline" })}
      >
        Next Knowledge Objects
      </a>
    </nav>
  )
