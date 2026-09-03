import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { readApprovedBudget } from "@/app/api/imports/approve/route"
import { readImportFilters } from "@/app/api/imports/prepare/route"
import {
  IMPORT_STATUSES,
  importPath,
  readExpectedStatus,
  readImportId,
} from "@/server/actions/import-command"

/**
 * EEM-9/04 C04-3.
 *
 * Every rule here mirrors the contract rather than a house preference, and each
 * is asserted at the edge where the contract refuses. A body the backend would
 * bounce is never built, because building one and letting the backend answer
 * would make the Console the source of an avoidable failed request.
 */

const REPOSITORY = "00000000-0000-4000-8000-0000000000b2"
const IMPORT = "00000000-0000-4000-8000-0000000000c3"

const form = (entries: Record<string, string>): FormData => {
  const data = new FormData()
  for (const [name, value] of Object.entries(entries)) data.set(name, value)
  return data
}

describe("the merge window a range asks for", () => {
  it("asks for the entire history by naming no bound at all", () => {
    // Omitting both bounds is how the contract requests everything, so an
    // empty object is a complete answer rather than a missing one.
    expect(readImportFilters(form({ range: "ENTIRE_HISTORY" }))).toEqual({})
  })

  it("bounds the last twelve months below and leaves the present open", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-03T08:00:00Z"))

    expect(readImportFilters(form({ range: "LAST_12_MONTHS" }))).toEqual({
      mergedFrom: "2025-09-03T08:00:00Z",
    })

    vi.useRealTimers()
  })

  it("carries an inclusive custom window as whole days", () => {
    expect(
      readImportFilters(
        form({ range: "CUSTOM", mergedFrom: "2026-01-01", mergedTo: "2026-01-31" }),
      ),
    ).toEqual({
      mergedFrom: "2026-01-01T00:00:00Z",
      mergedTo: "2026-01-31T23:59:59Z",
    })
  })

  it("refuses a window that cannot be honoured", () => {
    const cases: Record<string, Record<string, string>> = {
      "no range at all": {},
      "a range the requirement does not define": { range: "SINCE_LAST_RUN" },
      "a custom range with no bounds": { range: "CUSTOM" },
      "a custom range missing its upper bound": {
        range: "CUSTOM",
        mergedFrom: "2026-01-01",
      },
      "bounds the wrong way round": {
        range: "CUSTOM",
        mergedFrom: "2026-02-01",
        mergedTo: "2026-01-01",
      },
      "a day that does not exist": {
        range: "CUSTOM",
        mergedFrom: "2026-02-30",
        mergedTo: "2026-03-01",
      },
      "a bound that is not a calendar day": {
        range: "CUSTOM",
        mergedFrom: "yesterday",
        mergedTo: "2026-03-01",
      },
    }

    for (const [label, entries] of Object.entries(cases)) {
      expect(readImportFilters(form(entries)), label).toBeUndefined()
    }
  })

  it("names no mode, because the customer API fixes one", () => {
    const filters = readImportFilters(
      form({ range: "ENTIRE_HISTORY", mode: "reextract" }),
    )

    expect(filters).toEqual({})
    expect(JSON.stringify(filters)).not.toContain("reextract")
  })
})

describe("the approved cost budget", () => {
  it("carries exactly six fraction digits", () => {
    expect(readApprovedBudget("25")).toBe("25.000000")
    expect(readApprovedBudget("25.5")).toBe("25.500000")
  })

  it("refuses an amount that rounds to the value the contract forbids", () => {
    // Positive is not the same as non-zero once it is rounded: `toFixed(6)`
    // turns anything under a microdollar into exactly `0.000000`.
    expect(readApprovedBudget("0.0000001")).toBeUndefined()
    expect(readApprovedBudget("0")).toBeUndefined()
    expect(readApprovedBudget("-5")).toBeUndefined()
  })

  it("refuses an amount that is not a bounded number", () => {
    for (const raw of ["", "free", "1e400", "9999999999999", "NaN"]) {
      expect(readApprovedBudget(raw), raw).toBeUndefined()
    }
  })
})

describe("the optimistic token an import mutation carries", () => {
  it("accepts only a status the contract publishes", () => {
    for (const status of IMPORT_STATUSES) {
      expect(readExpectedStatus(form({ expectedStatus: status }))).toBe(status)
    }
    expect(readExpectedStatus(form({ expectedStatus: "RECONCILING" }))).toBeUndefined()
    expect(readExpectedStatus(form({}))).toBeUndefined()
  })

  it("publishes exactly the eight states the requirement maps", () => {
    expect([...IMPORT_STATUSES]).toEqual([
      "PLANNING",
      "DISCOVERING",
      "AWAITING_APPROVAL",
      "PROCESSING",
      "PAUSED",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ])
  })

  it("accepts only a UUID import identifier", () => {
    expect(readImportId(form({ importId: IMPORT }))).toBe(IMPORT)
    expect(readImportId(form({ importId: "../../imports/other" }))).toBeUndefined()
    expect(readImportId(form({}))).toBeUndefined()
  })
})

describe("where a refused command sends the customer", () => {
  it("returns to the import surface it came from", () => {
    expect(importPath(REPOSITORY)).toBe(`/repositories/${REPOSITORY}/import`)
  })

  it("falls back to the list rather than building a path from a bad identifier", () => {
    expect(importPath("../../etc")).toBe("/repositories")
    expect(importPath("")).toBe("/repositories")
  })
})

describe("environment isolation", () => {
  const original = process.env

  beforeEach(() => {
    process.env = { ...original }
  })

  afterEach(() => {
    process.env = original
  })

  it("shapes a request without reading any server secret", () => {
    // The field readers are pure. If one of them ever needed configuration it
    // would stop being provable without a running server, which is the whole
    // reason they are exported.
    process.env = {} as NodeJS.ProcessEnv

    expect(readImportFilters(form({ range: "ENTIRE_HISTORY" }))).toEqual({})
    expect(readApprovedBudget("1")).toBe("1.000000")
  })
})
