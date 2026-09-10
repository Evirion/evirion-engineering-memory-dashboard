import { describe, expect, it } from "vitest"

import {
  PROCESSING_PAGE_SIZE,
  processingPath,
  processingQueryString,
  readProcessingQuery,
} from "@/lib/processing/query"

const REPOSITORY = "00000000-0000-4000-8000-0000000000c4"
const CURSOR = "00000000-0000-4000-8000-00000000b001"

describe("reading the processing query", () => {
  it("pins the page size so a caller cannot choose it", () => {
    expect(PROCESSING_PAGE_SIZE).toBe(20)
    expect(readProcessingQuery({ pageSize: "100" })).toEqual({})
  })

  it("reads the repository, cursor and sort the surface publishes", () => {
    expect(
      readProcessingQuery({
        repositoryId: REPOSITORY,
        after: CURSOR,
        sort: "pullRequest",
        dir: "desc",
      }),
    ).toEqual({
      repositoryId: REPOSITORY,
      after: CURSOR,
      sort: "pullRequest",
      dir: "desc",
    })
  })

  it("defaults a published sort to ascending when the direction is absent", () => {
    expect(readProcessingQuery({ sort: "updated" })).toEqual({
      sort: "updated",
      dir: "asc",
    })
  })

  it.each([
    ["sort", "cost"],
    ["dir", "up"],
  ])("drops %s when the value is one the surface does not admit", (key, value) => {
    expect(readProcessingQuery({ [key]: value })).toEqual({})
  })

  it("forwards a malformed repository identifier so the read can refuse it", () => {
    expect(readProcessingQuery({ repositoryId: "not-a-uuid" })).toEqual({
      repositoryId: "not-a-uuid",
    })
  })

  it("forwards a malformed cursor so the read can refuse it", () => {
    expect(readProcessingQuery({ after: "'; drop table --" })).toEqual({
      after: "'; drop table --",
    })
  })

  it("drops a direction that arrives without a sort", () => {
    expect(readProcessingQuery({ dir: "desc" })).toEqual({})
  })
})

describe("writing the processing link", () => {
  it("drops the cursor by default so a new predicate restarts the scan", () => {
    const query = {
      repositoryId: REPOSITORY,
      after: CURSOR,
      sort: "pullRequest",
      dir: "asc",
    } as const

    expect(processingQueryString(query)).toBe(
      `?repositoryId=${REPOSITORY}&sort=pullRequest&dir=asc`,
    )
    expect(processingQueryString(query, { keepCursor: true })).toBe(
      `?repositoryId=${REPOSITORY}&after=${CURSOR}&sort=pullRequest&dir=asc`,
    )
  })

  it("returns the processing path with an empty string when nothing is filtered", () => {
    expect(processingQueryString({})).toBe("")
    expect(processingPath({})).toBe("/processing")
  })
})
