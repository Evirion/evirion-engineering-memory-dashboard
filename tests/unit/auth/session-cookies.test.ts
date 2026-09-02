import { describe, expect, it } from "vitest"

import {
  COOKIE_ATTRIBUTES,
  CookieBudgetError,
  SESSION_COOKIE_BASE,
  boundedSlotNames,
  chunkName,
  clearSessionCookies,
  createGeneration,
  maximumPayloadBytes,
  parseSessionCookies,
  requestHeaderBytes,
  serializeSessionCookies,
} from "@/lib/auth/session-cookies"
import { COOKIE_BUDGET } from "@/lib/auth/session-policy"

const GENERATION = "abcd1234"
const OTHER_GENERATION = "wxyz9876"
const BASE = SESSION_COOKIE_BASE

const toRecord = (
  instructions: { name: string; value: string }[],
): Record<string, string> =>
  Object.fromEntries(instructions.map(({ name, value }) => [name, value]))

const write = (payload: string, generation = GENERATION): Record<string, string> =>
  toRecord(serializeSessionCookies(BASE, payload, generation, 3600))

describe("__Host- session cookie attributes", () => {
  it("uses the host-scoped prefix with no Domain", () => {
    const instructions = serializeSessionCookies(BASE, "payload", GENERATION, 3600)

    expect(BASE.startsWith("__Host-")).toBe(true)
    for (const instruction of instructions) {
      expect(instruction.name.startsWith("__Host-")).toBe(true)
      expect(instruction.httpOnly).toBe(true)
      expect(instruction.secure).toBe(true)
      expect(instruction.sameSite).toBe("lax")
      expect(instruction.path).toBe("/")
      expect(instruction).not.toHaveProperty("domain")
    }
    expect(COOKIE_ATTRIBUTES).not.toHaveProperty("domain")
  })

  it("emits exactly the frozen chunk count and stays inside the chunk budget", () => {
    const instructions = serializeSessionCookies(
      BASE,
      "x".repeat(4000),
      GENERATION,
      3600,
    )

    expect(instructions).toHaveLength(COOKIE_BUDGET.chunkMaximum)
    for (const instruction of instructions) {
      expect(instruction.value.length).toBeLessThanOrEqual(
        COOKIE_BUDGET.chunkValueBytes,
      )
    }
  })

  it("is deterministic for the same payload and generation", () => {
    expect(serializeSessionCookies(BASE, "payload", GENERATION, 3600)).toEqual(
      serializeSessionCookies(BASE, "payload", GENERATION, 3600),
    )
  })

  it("round-trips the largest payload both budgets allow", () => {
    const payload = "y".repeat(maximumPayloadBytes(BASE))
    const result = parseSessionCookies(BASE, write(payload))

    expect(result).toEqual({ status: "valid", payload, generation: GENERATION })
  })

  it("refuses a payload that fits four chunks but not the inbound header", () => {
    // Four full chunks are 12288 bytes and no 8192-byte Cookie header can
    // carry them back, so the aggregate budget binds first. Writing such a
    // session would lock the principal out on the next request.
    const beyondAggregate = "y".repeat(maximumPayloadBytes(BASE) + 1)

    expect(beyondAggregate.length).toBeLessThan(
      COOKIE_BUDGET.chunkValueBytes * COOKIE_BUDGET.chunkMaximum,
    )
    expect(() =>
      serializeSessionCookies(BASE, beyondAggregate, GENERATION, 3600),
    ).toThrow(CookieBudgetError)
  })

  it("mints a distinct generation each time", () => {
    const generations = new Set(Array.from({ length: 32 }, () => createGeneration()))

    expect(generations.size).toBe(32)
  })
})

describe("rotation and logout clear every bounded slot", () => {
  it("clears the unchunked slot and all four chunks", () => {
    const cleared = clearSessionCookies(BASE)

    expect(cleared.map(({ name }) => name)).toEqual(boundedSlotNames(BASE))
    expect(cleared).toHaveLength(COOKIE_BUDGET.chunkMaximum + 1)
    for (const instruction of cleared) {
      expect(instruction.maxAge).toBe(0)
      expect(instruction.value).toBe("")
      expect(instruction.secure).toBe(true)
      expect(instruction.httpOnly).toBe(true)
    }
  })

  it("leaves no readable chunk after a clear is applied", () => {
    const live = write("payload")
    for (const { name } of clearSessionCookies(BASE)) {
      delete live[name]
    }

    expect(parseSessionCookies(BASE, live)).toEqual({ status: "absent" })
  })
})

describe("fail-closed budget enforcement", () => {
  it("refuses a payload larger than four chunks rather than truncating", () => {
    const oversize = "z".repeat(
      COOKIE_BUDGET.chunkValueBytes * COOKIE_BUDGET.chunkMaximum + 1,
    )

    expect(() => serializeSessionCookies(BASE, oversize, GENERATION, 3600)).toThrow(
      CookieBudgetError,
    )
  })

  it("rejects an inbound Cookie header over the frozen aggregate budget", () => {
    const cookies = {
      ...write("payload"),
      "unrelated-bulk": "q".repeat(COOKIE_BUDGET.requestHeaderBytes),
    }

    expect(requestHeaderBytes(cookies)).toBeGreaterThan(
      COOKIE_BUDGET.requestHeaderBytes,
    )
    expect(parseSessionCookies(BASE, cookies)).toEqual({
      status: "rejected",
      reason: "request-header-over-budget",
    })
  })

  it("refuses a malformed generation", () => {
    expect(() => serializeSessionCookies(BASE, "payload", "short", 3600)).toThrow(
      CookieBudgetError,
    )
  })
})

describe("adversarial chunk states all fail closed", () => {
  it("reports absent only when no slot is present", () => {
    expect(parseSessionCookies(BASE, {})).toEqual({ status: "absent" })
    expect(parseSessionCookies(BASE, { unrelated: "value" })).toEqual({
      status: "absent",
    })
  })

  it("rejects an unchunked cookie sitting beside chunks", () => {
    const cookies = { ...write("payload"), [BASE]: "legacy-single-cookie" }

    expect(parseSessionCookies(BASE, cookies)).toEqual({
      status: "rejected",
      reason: "unchunked-and-chunked-collision",
    })
  })

  it("rejects an unchunked cookie with no chunks at all", () => {
    expect(parseSessionCookies(BASE, { [BASE]: "legacy" })).toEqual({
      status: "rejected",
      reason: "corrupt-chunk",
    })
  })

  it("rejects a missing chunk", () => {
    const cookies = write("w".repeat(4000))
    delete cookies[chunkName(BASE, 2)]

    expect(parseSessionCookies(BASE, cookies)).toEqual({
      status: "rejected",
      reason: "missing-chunk",
    })
  })

  it("rejects a gap in the middle of the sequence", () => {
    const cookies = write("w".repeat(4000))
    delete cookies[chunkName(BASE, 1)]

    expect(parseSessionCookies(BASE, cookies)).toEqual({
      status: "rejected",
      reason: "missing-chunk",
    })
  })

  it("rejects a chunk index beyond the frozen maximum", () => {
    const cookies = {
      ...write("payload"),
      [chunkName(BASE, COOKIE_BUDGET.chunkMaximum)]: `${GENERATION}.4.4.extra`,
    }

    expect(parseSessionCookies(BASE, cookies)).toEqual({
      status: "rejected",
      reason: "excess-chunks",
    })
  })

  it("rejects a reordered set, because the name and the signed index disagree", () => {
    const cookies = write("w".repeat(4000))
    const first = cookies[chunkName(BASE, 0)] as string
    const second = cookies[chunkName(BASE, 1)] as string
    cookies[chunkName(BASE, 0)] = second
    cookies[chunkName(BASE, 1)] = first

    expect(parseSessionCookies(BASE, cookies)).toEqual({
      status: "rejected",
      reason: "corrupt-chunk",
    })
  })

  it("rejects a corrupt chunk prefix", () => {
    const cookies = write("payload")
    cookies[chunkName(BASE, 1)] = "not-a-valid-prefix"

    expect(parseSessionCookies(BASE, cookies)).toEqual({
      status: "rejected",
      reason: "corrupt-chunk",
    })
  })

  it("rejects a non-numeric chunk suffix", () => {
    const cookies = { ...write("payload"), [`${BASE}.x`]: `${GENERATION}.0.4.body` }

    expect(parseSessionCookies(BASE, cookies)).toEqual({
      status: "rejected",
      reason: "corrupt-chunk",
    })
  })

  it("rejects chunks from two different generations", () => {
    const cookies = write("w".repeat(4000))
    const other = write("w".repeat(4000), OTHER_GENERATION)
    cookies[chunkName(BASE, 3)] = other[chunkName(BASE, 3)] as string

    expect(parseSessionCookies(BASE, cookies)).toEqual({
      status: "rejected",
      reason: "mixed-generation",
    })
  })

  it("rejects a stale higher chunk left behind by a longer prior session", () => {
    const cookies = write("payload")
    // Rewrite the set as a two-chunk generation and leave the old third chunk.
    const shortened: Record<string, string> = {
      [chunkName(BASE, 0)]: `${GENERATION}.0.2.first`,
      [chunkName(BASE, 1)]: `${GENERATION}.1.2.second`,
      [chunkName(BASE, 2)]: cookies[chunkName(BASE, 2)] as string,
    }

    const result = parseSessionCookies(BASE, shortened)

    expect(result.status).toBe("rejected")
    expect(result).toHaveProperty("reason")
  })

  it("never returns a partially reconstructed payload for any rejection", () => {
    const broken: Record<string, string>[] = [
      { ...write("payload"), [BASE]: "legacy" },
      { [chunkName(BASE, 0)]: "garbage" },
      { [chunkName(BASE, 1)]: `${GENERATION}.1.2.only-second` },
    ]

    for (const cookies of broken) {
      const result = parseSessionCookies(BASE, cookies)

      expect(result.status).toBe("rejected")
      expect(result).not.toHaveProperty("payload")
    }
  })
})
