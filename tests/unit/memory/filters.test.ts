import { describe, expect, it } from "vitest"

import {
  knowledgeQueryString,
  knowledgeQueuePath,
  readKnowledgeFilters,
} from "@/lib/knowledge/filters"

/**
 * EEM-9/05 C05, `MEM-002`.
 *
 * The filter state lives in the URL so it can be shared, which means a crafted
 * URL is an input this surface has to survive. A value the contract does not
 * admit is dropped rather than forwarded: the queue then reads as unfiltered
 * instead of steering the path the adapter builds or echoing crafted text back
 * to the customer.
 */

const REPOSITORY = "00000000-0000-4000-8000-0000000000c4"
const PULL_REQUEST = "00000000-0000-4000-8000-0000000000c5"

describe("reading the queue predicates", () => {
  it("reads every predicate the contract publishes", () => {
    expect(
      readKnowledgeFilters({
        repositoryId: REPOSITORY,
        knowledgeType: "ArchitectureDecision",
        reviewStatus: "APPROVED",
        lifecycleState: "ACTIVE",
        pullRequestId: PULL_REQUEST,
        authorLogin: "octo-cat_1.x",
        mergedFrom: "2026-08-01T00:00:00Z",
        mergedTo: "2026-09-01T00:00:00Z",
        after: REPOSITORY,
      }),
    ).toEqual({
      repositoryId: REPOSITORY,
      knowledgeType: "ArchitectureDecision",
      reviewStatus: "APPROVED",
      lifecycleState: "ACTIVE",
      pullRequestId: PULL_REQUEST,
      authorLogin: "octo-cat_1.x",
      mergedFrom: "2026-08-01T00:00:00Z",
      mergedTo: "2026-09-01T00:00:00Z",
      after: REPOSITORY,
    })
  })

  it("leaves an absent review status absent rather than defaulting it", () => {
    // The backend owns the PENDING default. Supplying it here would make the
    // Console the authority on what the review queue shows.
    expect(readKnowledgeFilters({})).toEqual({})
    expect(readKnowledgeFilters({ reviewStatus: "" })).toEqual({})
  })

  it.each([
    ["reviewStatus", "ESCALATED"],
    ["lifecycleState", "ARCHIVED"],
    ["repositoryId", "../../internal/console/v1/session"],
    ["pullRequestId", "not-a-uuid"],
    ["knowledgeType", "Architecture Decision"],
    ["authorLogin", "octo cat"],
    ["mergedFrom", "yesterday"],
    ["mergedTo", "2026-13-45"],
    ["after", "'; drop table --"],
  ])("drops %s when the value is one the contract does not admit", (key, value) => {
    expect(readKnowledgeFilters({ [key]: value })).toEqual({})
  })

  it("takes the first value when a parameter repeats", () => {
    expect(readKnowledgeFilters({ reviewStatus: ["EDITED", "APPROVED"] })).toEqual({
      reviewStatus: "EDITED",
    })
  })
})

describe("writing the queue link", () => {
  it("drops the cursor by default so a new predicate restarts the scan", () => {
    // Resuming someone else's page under a different predicate would silently
    // skip rows, because the cursor names a position in the previous ordering.
    const filters = { reviewStatus: "APPROVED", after: REPOSITORY } as const

    expect(knowledgeQueryString(filters)).toBe("?reviewStatus=APPROVED")
    expect(knowledgeQueryString(filters, { keepCursor: true })).toBe(
      `?reviewStatus=APPROVED&after=${REPOSITORY}`,
    )
  })

  it("returns an empty string when nothing is filtered", () => {
    expect(knowledgeQueryString({})).toBe("")
    expect(knowledgeQueuePath({})).toBe("/memory")
  })

  it("pins the repository in the path and never repeats it as a predicate", () => {
    // A predicate could be edited into a different repository than the page
    // the reviewer is on. A path segment cannot.
    const path = knowledgeQueuePath(
      { repositoryId: REPOSITORY, reviewStatus: "EDITED" },
      { repositoryId: REPOSITORY },
    )

    expect(path).toBe(`/repositories/${REPOSITORY}/memory?reviewStatus=EDITED`)
    expect(path).not.toContain("repositoryId=")
  })
})
