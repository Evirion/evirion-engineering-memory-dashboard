import type { ProcessingPage } from "@contracts/console"

import {
  PROCESSING_PAGE_SIZE,
  type ProcessingDirection,
  type ProcessingSort,
} from "@/lib/processing/query"

export type ProcessingRow = ProcessingPage["items"][number]

export type CursorPage<T> = {
  readonly items: readonly T[]
  readonly nextCursor: string | null
}

/**
 * How far a presentation-order scan will page the backend.
 *
 * Column sort is not a published processing-activity parameter. The Console
 * therefore reads the tenant-scoped list to completion, then orders and windows
 * it. Exhausting this bound is reported as truncated rather than as a complete
 * page that silently dropped later rows.
 */
export const PROCESSING_COLLECT_PAGE_LIMIT = 20

const compareText = (left: string, right: string): number => left.localeCompare(right)

const compareColumn = (
  left: ProcessingRow,
  right: ProcessingRow,
  sort: ProcessingSort,
): number => {
  switch (sort) {
    case "repository":
      return compareText(left.nameWithOwner, right.nameWithOwner)
    case "pullRequest": {
      const byNumber = left.pullRequestNumber - right.pullRequestNumber
      if (byNumber !== 0) return byNumber
      return compareText(left.pullRequestTitle ?? "", right.pullRequestTitle ?? "")
    }
    case "outcome":
      return compareText(left.processingState, right.processingState)
    case "authorization":
      return compareText(left.paidAuthorizationStatus, right.paidAuthorizationStatus)
    case "job": {
      const byJob = compareText(left.jobStatus, right.jobStatus)
      if (byJob !== 0) return byJob
      return compareText(left.sourceStatus, right.sourceStatus)
    }
    case "updated":
      return compareText(left.updatedAt, right.updatedAt)
    default: {
      const exhaustive: never = sort
      throw new Error(`unhandled processing sort: ${String(exhaustive)}`)
    }
  }
}

export const sortProcessingRows = (
  items: readonly ProcessingRow[],
  sort: ProcessingSort,
  dir: ProcessingDirection,
): ProcessingRow[] => {
  const sign = dir === "desc" ? -1 : 1
  return items.toSorted((left, right) => {
    const column = compareColumn(left, right, sort)
    if (column !== 0) return column * sign
    return compareText(left.extractionJobId, right.extractionJobId)
  })
}

export const paginateProcessingRows = (
  items: readonly ProcessingRow[],
  after: string | undefined,
): ProcessingPage => {
  const start =
    after === undefined
      ? 0
      : items.findIndex((row) => row.extractionJobId === after) + 1
  const pageItems = items.slice(start, start + PROCESSING_PAGE_SIZE)
  const exhausted = start + pageItems.length >= items.length

  return {
    items: pageItems,
    page: {
      nextCursor: exhausted ? null : (pageItems.at(-1)?.extractionJobId ?? null),
    },
  }
}

export const collectCursorPages = async <T>(
  fetchPage: (after: string | undefined) => Promise<CursorPage<T>>,
  limit: number,
): Promise<
  | { readonly ok: true; readonly items: T[] }
  | { readonly ok: false; readonly truncated: true }
> => {
  const items: T[] = []
  let after: string | undefined

  for (let visited = 0; visited < limit; visited += 1) {
    // Each request needs the cursor the previous one returned.
    // oxlint-disable-next-line no-await-in-loop
    const page = await fetchPage(after)
    items.push(...page.items)
    if (page.nextCursor === null) return { ok: true, items }
    if (page.nextCursor === after) return { ok: false, truncated: true }
    after = page.nextCursor
  }

  return { ok: false, truncated: true }
}
