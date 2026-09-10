import { describe, expect, it } from "vitest"

import type { ProcessingPage } from "@contracts/console"

import {
  collectCursorPages,
  paginateProcessingRows,
  sortProcessingRows,
} from "@/lib/processing/sort"

const row = (
  overrides: Partial<ProcessingPage["items"][number]> &
    Pick<ProcessingPage["items"][number], "extractionJobId" | "pullRequestNumber">,
): ProcessingPage["items"][number] => ({
  mappingVersion: "1",
  effectiveJobId: overrides.extractionJobId,
  isAlias: false,
  repositoryId: "00000000-0000-4000-8000-000000000007",
  nameWithOwner: "acme/extraction",
  pullRequestTitle: "Add webhook handler",
  jobStatus: "COMPLETED",
  sourceStatus: "READY",
  admissionDisposition: "ACCEPTED",
  attempts: 1,
  sourceAttempts: 1,
  paidAuthorizationStatus: "AUTHORIZED",
  processingState: "ACCEPTED",
  lastErrorCode: null,
  sourceLastErrorCode: null,
  updatedAt: "2026-09-01T12:00:00Z",
  ...overrides,
})

const FIRST = "00000000-0000-4000-8000-00000000b001"
const SECOND = "00000000-0000-4000-8000-00000000b002"
const THIRD = "00000000-0000-4000-8000-00000000b003"

describe("sorting processing rows", () => {
  it("orders by pull request number and keeps job identity as the tie-break", () => {
    const later = row({
      extractionJobId: THIRD,
      pullRequestNumber: 1,
      nameWithOwner: "zeta/repo",
    })
    const earlier = row({
      extractionJobId: FIRST,
      pullRequestNumber: 40,
    })
    const sameNumber = row({
      extractionJobId: SECOND,
      pullRequestNumber: 1,
      nameWithOwner: "acme/repo",
    })

    const ordered = sortProcessingRows(
      [earlier, later, sameNumber],
      "pullRequest",
      "asc",
    )

    expect(ordered.map((entry) => entry.extractionJobId)).toEqual([
      SECOND,
      THIRD,
      FIRST,
    ])
  })

  it("reverses the published direction without dropping the tie-break", () => {
    const ordered = sortProcessingRows(
      [
        row({ extractionJobId: FIRST, pullRequestNumber: 2, nameWithOwner: "acme/a" }),
        row({ extractionJobId: SECOND, pullRequestNumber: 2, nameWithOwner: "acme/b" }),
        row({ extractionJobId: THIRD, pullRequestNumber: 9 }),
      ],
      "repository",
      "desc",
    )

    expect(ordered.map((entry) => entry.extractionJobId)).toEqual([
      THIRD,
      SECOND,
      FIRST,
    ])
  })
})

describe("paginating processing rows", () => {
  it("returns at most twenty rows and names the last as the next cursor", () => {
    const items = Array.from({ length: 21 }, (_, index) =>
      row({
        extractionJobId: `00000000-0000-4000-8000-00000000b${String(index + 101).padStart(3, "0")}`,
        pullRequestNumber: index + 1,
      }),
    )

    const first = paginateProcessingRows(items, undefined)
    expect(first.items).toHaveLength(20)
    expect(first.page.nextCursor).toBe(items[19]?.extractionJobId)

    const second = paginateProcessingRows(items, first.page.nextCursor ?? undefined)
    expect(second.items).toHaveLength(1)
    expect(second.page.nextCursor).toBeNull()
  })
})

describe("collecting cursor pages", () => {
  it("walks every backend page until the cursor ends", async () => {
    const pages = [
      {
        items: [row({ extractionJobId: FIRST, pullRequestNumber: 1 })],
        nextCursor: FIRST,
      },
      {
        items: [row({ extractionJobId: SECOND, pullRequestNumber: 2 })],
        nextCursor: null,
      },
    ]

    const collected = await collectCursorPages(async (after) => {
      if (after === undefined) return pages[0]!
      if (after === FIRST) return pages[1]!
      throw new Error(`unexpected cursor ${after}`)
    }, 4)

    expect(collected.ok).toBe(true)
    if (!collected.ok) return
    expect(collected.items.map((entry) => entry.extractionJobId)).toEqual([
      FIRST,
      SECOND,
    ])
  })

  it("refuses to invent a complete list once the bound is reached", async () => {
    const collected = await collectCursorPages(async (after) => {
      const id = after ?? FIRST
      return {
        items: [row({ extractionJobId: id, pullRequestNumber: 1 })],
        nextCursor: SECOND,
      }
    }, 2)

    expect(collected).toEqual({ ok: false, truncated: true })
  })
})
