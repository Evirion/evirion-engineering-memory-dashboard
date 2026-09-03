import type { KnowledgePage } from "@contracts/console"

import { type KnowledgeFilters, knowledgeQueuePath } from "@/lib/knowledge/filters"
import { queueRow } from "@/lib/knowledge/presentation"

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
    return (
      <p
        data-testid="memory-queue-empty"
        className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
      >
        No Knowledge Object matches these filters. Machine-rejected and quarantined
        extractions are never listed here.
      </p>
    )
  }

  return (
    <ul aria-label="Knowledge Objects" className="flex flex-col gap-3">
      {page.items.map((summary) => {
        const row = queueRow(summary)
        return (
          <li
            key={row.knowledgeObjectId}
            data-testid="memory-queue-row"
            className="flex flex-col gap-2 rounded border border-slate-300 bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <a
                href={`/memory/${row.knowledgeObjectId}`}
                className="text-sm font-semibold text-slate-900 underline underline-offset-2"
              >
                {row.shortClaim}
              </a>
              <span className="text-xs text-slate-600">{row.knowledgeType}</span>
            </div>
            <p className="text-xs text-slate-700">
              {formatPullRequest(row.pullRequestNumber, row.pullRequestTitle)}
            </p>
            {/* Review and lifecycle are two axes. Each keeps its own label so
                neither can be read as the other. */}
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Review
                </dt>
                <dd className="text-sm text-slate-900">{row.reviewLabel}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Lifecycle
                </dt>
                <dd className="text-sm text-slate-900">{row.lifecycleLabel}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Source
                </dt>
                <dd className="text-sm text-slate-700">{formatMerged(row.mergedAt)}</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-600">
              Model confidence {row.confidence} of 100
            </p>
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
    <nav aria-label="Knowledge Object pages">
      <a
        href={knowledgeQueuePath(
          { ...filters, after: page.page.nextCursor },
          { keepCursor: true, ...(repositoryId === undefined ? {} : { repositoryId }) },
        )}
        className="text-sm text-slate-900 underline underline-offset-2"
      >
        Next Knowledge Objects
      </a>
    </nav>
  )
