import { describe, expect, it } from "vitest"

import { readConsentFields } from "@/app/api/repositories/policy/route"

/**
 * EEM-9/03, from the independent review wave, extended by EEM-9/03e.
 *
 * The consent body must satisfy the contract before it is ever sent. Two of
 * these were real defects: an amount below a microdollar rounded to exactly
 * the ceiling the contract forbids, and a repeated model profile passed a
 * schema that requires unique items.
 *
 * EEM-9/03e adds the published catalogue as a second, independent bound. The
 * profiles now arrive as repeated form fields from a checkbox group rather than
 * as one comma-separated string, and membership of the offered set is checked
 * in addition to the contract pattern rather than instead of it.
 */

const OFFERED = new Set(["standard-extraction", "one", "two", "three"])

const complete = {
  callCeiling: "100",
  budgetCeilingUsd: "12.5",
  retryPolicy: "NO_RETRY",
  expiresAt: "2099-01-01T00:00",
}

const form = (
  overrides: Record<string, string> = {},
  profiles: readonly string[] = ["standard-extraction"],
): FormData => {
  const data = new FormData()
  for (const [name, value] of Object.entries({ ...complete, ...overrides })) {
    data.set(name, value)
  }
  // A checkbox group posts the same name once per checked box, so the reader
  // takes every value rather than splitting one.
  for (const profile of profiles) data.append("allowedModelProfiles", profile)
  return data
}

const read = (
  overrides: Record<string, string> = {},
  profiles?: readonly string[],
  offered: ReadonlySet<string> = OFFERED,
) => readConsentFields(form(overrides, profiles), offered)

describe("the budget ceiling", () => {
  it("renders a normal amount with exactly six fraction digits", () => {
    expect(read()?.budgetCeilingUsd).toBe("12.500000")
    expect(read({ budgetCeilingUsd: "1" })?.budgetCeilingUsd).toBe("1.000000")
  })

  it.each(["0.0000001", "0.0000004", "1e-9"])(
    "refuses %s, which is positive but rounds to the forbidden zero ceiling",
    (amount) => {
      // The contract carries `not: { const: "0.000000" }`, so this body would
      // have been refused by the backend after being built.
      expect(read({ budgetCeilingUsd: amount })).toBeUndefined()
    },
  )

  it("accepts the smallest ceiling the contract can express", () => {
    expect(read({ budgetCeilingUsd: "0.000001" })?.budgetCeilingUsd).toBe("0.000001")
  })

  it.each(["0", "-1", "abc", "", "1000000000000"])("refuses %s", (amount) => {
    expect(read({ budgetCeilingUsd: amount })).toBeUndefined()
  })

  it("accepts the largest ceiling the pattern allows", () => {
    expect(read({ budgetCeilingUsd: "999999999999" })?.budgetCeilingUsd).toBe(
      "999999999999.000000",
    )
  })
})

describe("the model profiles", () => {
  it("takes every checked box and trims each value", () => {
    expect(read({}, ["one", " two ", "three"])?.allowedModelProfiles).toEqual([
      "one",
      "two",
      "three",
    ])
  })

  it("refuses a repeated profile, which the contract's uniqueItems forbids", () => {
    expect(read({}, ["one", "one"])).toBeUndefined()
  })

  it("refuses a profile the organization is not offered", () => {
    // The catalogue is the new bound. A profile the backend would refuse at the
    // paid gate never becomes a recorded consent in the first place.
    expect(read({}, ["retired-profile"])).toBeUndefined()
    expect(read({}, ["one", "retired-profile"])).toBeUndefined()
  })

  it("still refuses a malformed profile the catalogue happens to contain", () => {
    // Offered here on purpose, so only the contract pattern can refuse it. The
    // catalogue was added beside the pattern check, not in place of it.
    const offered = new Set(["One", "a b"])

    expect(read({}, ["One"], offered)).toBeUndefined()
    expect(read({}, ["a b"], offered)).toBeUndefined()
  })

  it("refuses an empty selection and one beyond the maximum", () => {
    expect(read({}, [])).toBeUndefined()
    expect(read({}, [" ", ""])).toBeUndefined()

    const seventeen = Array.from({ length: 17 }, (_, index) => `p${index}`)
    expect(read({}, seventeen, new Set(seventeen))).toBeUndefined()
  })

  it("accepts exactly the maximum the contract allows", () => {
    const sixteen = Array.from({ length: 16 }, (_, index) => `p${index}`)

    expect(read({}, sixteen, new Set(sixteen))?.allowedModelProfiles).toHaveLength(16)
  })

  it("refuses everything when nothing is offered", () => {
    expect(read({}, ["standard-extraction"], new Set())).toBeUndefined()
  })
})

describe("the remaining consent fields", () => {
  it("emits an expiry in the exact instant form the contract publishes", () => {
    const expiresAt = read()?.expiresAt as string

    expect(expiresAt).toMatch(
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/,
    )
  })

  it("refuses an expiry in the past, which could authorize nothing", () => {
    expect(read({ expiresAt: "2020-01-01T00:00" })).toBeUndefined()
    expect(read({ expiresAt: "not a date" })).toBeUndefined()
  })

  it("refuses a call ceiling outside the contract range", () => {
    expect(read({ callCeiling: "0" })).toBeUndefined()
    expect(read({ callCeiling: "1000000001" })).toBeUndefined()
    expect(read({ callCeiling: "1.5" })).toBeUndefined()
  })

  it("refuses a retry policy the contract does not publish", () => {
    expect(read({ retryPolicy: "RETRY_FOREVER" })).toBeUndefined()
  })

  it("always states the scope the contract fixes", () => {
    expect(read()?.scope).toBe("LIVE_REPOSITORY")
  })
})
