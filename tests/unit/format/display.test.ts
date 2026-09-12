import { describe, expect, it } from "vitest"

import { formatInstant, formatUsd } from "@/lib/format/display"

/**
 * Customer-facing instants and amounts.
 *
 * The contract publishes ISO-8601 instants and six-fraction USD strings.
 * Those are the wire shape. Putting them on screen made an English Console
 * print `2026-09-10T14:40:54.951398Z` and `USD 10.000000`.
 */

describe("formatInstant", () => {
  it("does not echo a raw ISO instant", () => {
    const rendered = formatInstant("2026-09-10T14:40:54.951398Z")

    expect(rendered).not.toMatch(/T/)
    expect(rendered).not.toMatch(/Z/)
    expect(rendered).not.toContain("951398")
    expect(rendered).toContain("2026")
    expect(rendered).toMatch(/Sep/)
  })

  it("keeps a calendar day as a calendar day", () => {
    expect(formatInstant("2026-09-10")).toBe("10 Sept 2026")
  })

  it("leaves an unparseable value alone rather than inventing a date", () => {
    expect(formatInstant("not a date")).toBe("not a date")
  })
})

describe("formatUsd", () => {
  it("drops trailing zeros the contract used as a fixed width", () => {
    expect(formatUsd("10.000000")).toBe("USD 10")
    expect(formatUsd("12.500000")).toBe("USD 12.5")
    expect(formatUsd("18.400000")).toBe("USD 18.4")
    expect(formatUsd("0.000000")).toBe("USD 0")
  })

  it("keeps a microdollar, which rounding to cents would erase", () => {
    expect(formatUsd("0.000001")).toBe("USD 0.000001")
  })

  it("leaves a malformed amount alone rather than inventing one", () => {
    expect(formatUsd("not-money")).toBe("USD not-money")
  })
})
