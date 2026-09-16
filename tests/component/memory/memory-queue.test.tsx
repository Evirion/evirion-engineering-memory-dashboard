import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { KnowledgePage, KnowledgeSummary } from "@contracts/console"

import { MemoryFilters } from "@/components/memory/memory-filters"
import {
  MemoryQueueList,
  MemoryQueuePagination,
} from "@/components/memory/memory-queue"

import { KNOWLEDGE, KNOWLEDGE_OBJECTS } from "../../../tools/console-stub/fixtures.mjs"

/**
 * EEM-9/05 C05, `MEM-001` to `MEM-003`.
 *
 * The visual primitive is open decision 4, so nothing here asserts an element.
 * What is asserted is what the contract fixes either way: review and lifecycle
 * appear as two separately labelled states, a row carries the summary and no
 * provenance, a null pull request reads as absent rather than as a zero, and
 * the cursor control follows the backend's own `nextCursor`.
 */

const objects = KNOWLEDGE_OBJECTS()

const summaryOf = (id: string, overrides: Partial<KnowledgeSummary> = {}) => {
  const object = objects[id]
  const source = object?.base.sourceContext
  return {
    confidence: object?.base.confidence ?? 0,
    knowledgeObjectId: id,
    knowledgeType: object?.base.knowledgeType ?? "ArchitectureDecision",
    lifecycleState: object?.lifecycleState ?? "UNRESOLVED",
    mergedAt: source?.mergedAt ?? null,
    pullRequestNumber: source?.pullRequestNumber ?? null,
    pullRequestTitle: source?.pullRequestTitle ?? null,
    reviewStatus: object?.reviews.at(-1)?.decision ?? "PENDING",
    shortClaim: object?.shortClaim ?? "",
    ...overrides,
  } as KnowledgeSummary
}

const pageOf = (
  items: KnowledgeSummary[],
  nextCursor: string | null = null,
): KnowledgePage => ({ items, page: { nextCursor } })

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe("the queue row", () => {
  it("shows review and lifecycle as two states, never as one", () => {
    const html = markup(
      <MemoryQueueList page={pageOf([summaryOf(KNOWLEDGE.superseded)])} />,
    )

    // An object can be reviewed and superseded at once. Collapsing the two
    // into a single status makes an unanswerable support question.
    expect(html).toContain("Review")
    expect(html).toContain("Approved")
    expect(html).toContain("Lifecycle:")
    expect(html).toContain("Superseded")
  })

  it("names the claim as the accessible link, not the importance grade", () => {
    const claim = "Prefer explicit tenant boundaries in every public API handler."
    const html = markup(
      <MemoryQueueList
        page={pageOf([
          summaryOf(KNOWLEDGE.approved, {
            shortClaim: claim,
          }),
        ])}
      />,
    )

    expect(html).toContain(`>${claim}</a>`)
    expect(html).not.toMatch(/<a[^>]*>MEDIUM<\/a>/i)
  })

  it("carries the summary and no provenance at all", () => {
    const object = objects[KNOWLEDGE.approved]
    const html = markup(
      <MemoryQueueList page={pageOf([summaryOf(KNOWLEDGE.approved)])} />,
    )

    expect(html).toContain(object?.shortClaim ?? "")
    // Evidence, the original payload and every technical detail belong to the
    // detail projection. A list page never loads them per row.
    expect(html).not.toContain(object?.evidence[0]?.quote ?? "unreachable")
    expect(html).not.toContain(object?.base.technicalDetails.extractionRunId ?? "x")
    expect(html).not.toContain(object?.base.problem ?? "x")
  })

  it("reads a null pull request as absent rather than as a zero", () => {
    const html = markup(
      <MemoryQueueList
        page={pageOf([
          summaryOf(KNOWLEDGE.approved, {
            pullRequestNumber: null,
            pullRequestTitle: null,
            mergedAt: null,
          }),
        ])}
      />,
    )

    expect(html).toContain("No pull request recorded")
    expect(html).toContain("No merge date recorded")
    expect(html).not.toContain("#0")
  })

  it("names the empty queue as empty and says what is never listed", () => {
    const html = markup(<MemoryQueueList page={pageOf([])} />)

    expect(html).toContain("No Knowledge Object matches these filters")
    expect(html).toContain("quarantined")
  })

  it("links each row to its own detail route", () => {
    const html = markup(
      <MemoryQueueList page={pageOf([summaryOf(KNOWLEDGE.pending)])} />,
    )

    expect(html).toContain(`href="/memory/${KNOWLEDGE.pending}"`)
  })
})

describe("the cursor control", () => {
  it("is absent when the backend reports no next page", () => {
    expect(
      markup(
        <MemoryQueuePagination
          page={pageOf([summaryOf(KNOWLEDGE.pending)])}
          filters={{}}
        />,
      ),
    ).toBe("")
  })

  it("follows the backend cursor and keeps the predicates", () => {
    const html = markup(
      <MemoryQueuePagination
        page={pageOf([summaryOf(KNOWLEDGE.pending)], KNOWLEDGE.pending)}
        filters={{ reviewStatus: "APPROVED" }}
      />,
    )

    expect(html).toContain(`after=${KNOWLEDGE.pending}`)
    expect(html).toContain("reviewStatus=APPROVED")
  })

  it("keeps the repository in the path on the scoped queue", () => {
    const html = markup(
      <MemoryQueuePagination
        page={pageOf([summaryOf(KNOWLEDGE.pending)], KNOWLEDGE.pending)}
        filters={{ reviewStatus: "APPROVED" }}
        repositoryId={KNOWLEDGE.approved}
      />,
    )

    expect(html).toContain(`/repositories/${KNOWLEDGE.approved}/memory`)
    expect(html).not.toContain("repositoryId=")
  })
})

describe("the predicate form", () => {
  it("submits to its own URL rather than to a mutation route", () => {
    // It is a read. A GET form with no action puts the filter state in the
    // query string, which is what makes it shareable, and involves no BFF
    // route and no CSRF proof.
    const html = markup(<MemoryFilters filters={{}} repositoryChoices={[]} />)

    expect(html).toContain('method="get"')
    expect(html).not.toContain("action=")
    expect(html).not.toContain("csrfToken")
  })

  it("labels the absent review predicate as the backend default", () => {
    const html = markup(<MemoryFilters filters={{}} repositoryChoices={[]} />)

    expect(html).toContain("Awaiting review (default)")
  })

  it("omits the repository predicate when its options could not be read", () => {
    // Losing one predicate's option list is not losing the queue, and an empty
    // select would read as an organization with no repositories.
    const withoutChoices = markup(<MemoryFilters filters={{}} repositoryChoices={[]} />)
    const withChoices = markup(
      <MemoryFilters
        filters={{}}
        repositoryChoices={[{ id: KNOWLEDGE.approved, nameWithOwner: "acme/api" }]}
      />,
    )

    expect(withoutChoices).not.toContain('name="repositoryId"')
    expect(withChoices).toContain('name="repositoryId"')
    expect(withChoices).toContain("acme/api")
  })

  it("gives every control an accessible name", () => {
    // Open decision 4 owns the primitive, so the acceptance rows are written
    // against names rather than against a table or a card.
    const html = markup(<MemoryFilters filters={{}} repositoryChoices={[]} />)

    for (const name of [
      "reviewStatus",
      "lifecycleState",
      "knowledgeType",
      "authorLogin",
      "mergedFrom",
      "mergedTo",
    ]) {
      expect(html).toContain(`for="${name}"`)
      expect(html).toContain(`id="${name}"`)
    }
  })

  it("shows every predicate without asking the reader to open anything", () => {
    for (const filters of [
      {},
      { reviewStatus: "APPROVED" } as const,
      { lifecycleState: "ACTIVE" } as const,
    ]) {
      const html = markup(<MemoryFilters filters={filters} repositoryChoices={[]} />)

      expect(html).not.toMatch(/<details/)
      expect(html).not.toMatch(/<summary/)
      expect(html).toContain('for="mergedFrom"')
    }
  })

  it("drops one predicate and the cursor from each active-filter chip", () => {
    const cursor = KNOWLEDGE.pending
    const html = markup(
      <MemoryFilters
        filters={{
          reviewStatus: "APPROVED",
          lifecycleState: "ACTIVE",
          authorLogin: "octo-cat",
          after: cursor,
        }}
        repositoryChoices={[]}
      />,
    )

    const chips = Object.fromEntries(
      [...html.matchAll(/href="([^"]+)"[^>]*aria-label="Remove ([^"]+)"/g)].map(
        (match) => [match[2], (match[1] ?? "").replaceAll("&amp;", "&")],
      ),
    )

    expect(Object.keys(chips).toSorted()).toEqual([
      "Active",
      "Approved",
      "Author octo-cat",
    ])

    expect(chips["Approved"]).toContain("lifecycleState=ACTIVE")
    expect(chips["Approved"]).toContain("authorLogin=octo-cat")
    expect(chips["Approved"]).not.toContain("reviewStatus=")
    expect(chips["Approved"]).not.toContain("after=")

    expect(chips["Active"]).toContain("reviewStatus=APPROVED")
    expect(chips["Active"]).toContain("authorLogin=octo-cat")
    expect(chips["Active"]).not.toContain("lifecycleState=")
    expect(chips["Active"]).not.toContain("after=")

    expect(chips["Author octo-cat"]).toContain("reviewStatus=APPROVED")
    expect(chips["Author octo-cat"]).toContain("lifecycleState=ACTIVE")
    expect(chips["Author octo-cat"]).not.toContain("authorLogin=")
    expect(chips["Author octo-cat"]).not.toContain("after=")
  })

  it("does not treat a path-pinned repository as a removable or advanced filter", () => {
    const html = markup(
      <MemoryFilters
        filters={{ repositoryId: KNOWLEDGE.approved, reviewStatus: "APPROVED" }}
        repositoryChoices={[]}
        pinnedRepositoryId={KNOWLEDGE.approved}
      />,
    )

    expect(html).not.toMatch(/<details[^>]*\sopen[=>]/)
    expect(html).not.toContain(`aria-label="Remove ${KNOWLEDGE.approved}"`)
    expect(html).toContain(`href="/repositories/${KNOWLEDGE.approved}/memory"`)
    expect(html).not.toContain("repositoryId=")
  })

  it("keeps a pull-request predicate when the form is applied", () => {
    const pullRequestId = "00000000-0000-4000-8000-0000000000c5"
    const html = markup(
      <MemoryFilters
        filters={{ pullRequestId, reviewStatus: "APPROVED" }}
        repositoryChoices={[]}
      />,
    )

    expect(html).toContain(`name="pullRequestId"`)
    expect(html).toContain(`value="${pullRequestId}"`)
    expect(html).toContain('type="hidden"')
  })
})
