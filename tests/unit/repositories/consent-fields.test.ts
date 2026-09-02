import { describe, expect, it } from "vitest"

import { readConsentFields } from "@/app/api/repositories/policy/route"

/**
 * EEM-9/03, from the independent review wave.
 *
 * The consent body must satisfy the contract before it is ever sent. Two of
 * these were real defects: an amount below a microdollar rounded to exactly
 * the ceiling the contract forbids, and a repeated model profile passed a
 * schema that requires unique items.
 */

const complete = {
  allowedModelProfiles: "standard-extraction",
  callCeiling: "100",
  budgetCeilingUsd: "12.5",
  retryPolicy: "NO_RETRY",
  expiresAt: "2099-01-01T00:00",
}

const form = (overrides: Record<string, string> = {}): FormData => {
  const data = new FormData()
  for (const [name, value] of Object.entries({ ...complete, ...overrides })) {
    data.set(name, value)
  }
  return data
}

describe("the budget ceiling", () => {
  it("renders a normal amount with exactly six fraction digits", () => {
    expect(readConsentFields(form())?.budgetCeilingUsd).toBe("12.500000")
    expect(readConsentFields(form({ budgetCeilingUsd: "1" }))?.budgetCeilingUsd).toBe(
      "1.000000",
    )
  })

  it.each(["0.0000001", "0.0000004", "1e-9"])(
    "refuses %s, which is positive but rounds to the forbidden zero ceiling",
    (amount) => {
      // The contract carries `not: { const: "0.000000" }`, so this body would
      // have been refused by the backend after being built.
      expect(readConsentFields(form({ budgetCeilingUsd: amount }))).toBeUndefined()
    },
  )

  it("accepts the smallest ceiling the contract can express", () => {
    expect(
      readConsentFields(form({ budgetCeilingUsd: "0.000001" }))?.budgetCeilingUsd,
    ).toBe("0.000001")
  })

  it.each(["0", "-1", "abc", "", "1000000000000"])("refuses %s", (amount) => {
    expect(readConsentFields(form({ budgetCeilingUsd: amount }))).toBeUndefined()
  })

  it("accepts the largest ceiling the pattern allows", () => {
    expect(
      readConsentFields(form({ budgetCeilingUsd: "999999999999" }))?.budgetCeilingUsd,
    ).toBe("999999999999.000000")
  })
})

describe("the model profiles", () => {
  it("splits and trims a comma-separated list", () => {
    expect(
      readConsentFields(form({ allowedModelProfiles: "one, two ,three" }))
        ?.allowedModelProfiles,
    ).toEqual(["one", "two", "three"])
  })

  it("refuses a repeated profile, which the contract's uniqueItems forbids", () => {
    expect(
      readConsentFields(form({ allowedModelProfiles: "one, one" })),
    ).toBeUndefined()
  })

  it("refuses a profile the contract pattern rejects", () => {
    expect(readConsentFields(form({ allowedModelProfiles: "One" }))).toBeUndefined()
    expect(readConsentFields(form({ allowedModelProfiles: "a b" }))).toBeUndefined()
  })

  it("refuses an empty list and one beyond the maximum", () => {
    expect(readConsentFields(form({ allowedModelProfiles: " , " }))).toBeUndefined()
    const seventeen = Array.from({ length: 17 }, (_, index) => `p${index}`).join(",")
    expect(readConsentFields(form({ allowedModelProfiles: seventeen }))).toBeUndefined()
  })
})

describe("the remaining consent fields", () => {
  it("emits an expiry in the exact instant form the contract publishes", () => {
    const expiresAt = readConsentFields(form())?.expiresAt as string

    expect(expiresAt).toMatch(
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/,
    )
  })

  it("refuses an expiry in the past, which could authorize nothing", () => {
    expect(readConsentFields(form({ expiresAt: "2020-01-01T00:00" }))).toBeUndefined()
    expect(readConsentFields(form({ expiresAt: "not a date" }))).toBeUndefined()
  })

  it("refuses a call ceiling outside the contract range", () => {
    expect(readConsentFields(form({ callCeiling: "0" }))).toBeUndefined()
    expect(readConsentFields(form({ callCeiling: "1000000001" }))).toBeUndefined()
    expect(readConsentFields(form({ callCeiling: "1.5" }))).toBeUndefined()
  })

  it("refuses a retry policy the contract does not publish", () => {
    expect(readConsentFields(form({ retryPolicy: "RETRY_FOREVER" }))).toBeUndefined()
  })

  it("always states the scope the contract fixes", () => {
    expect(readConsentFields(form())?.scope).toBe("LIVE_REPOSITORY")
  })
})
