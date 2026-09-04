import { describe, expect, it } from "vitest"

import type { SessionContext } from "@contracts/console"

import {
  isReauthenticationFresh,
  isSessionReauthenticationFresh,
  reauthenticationFreshUntil,
} from "@/lib/auth/reauthentication-freshness"

const future = "2099-01-01T00:00:00.000Z"
const past = "2000-01-01T00:00:00.000Z"

describe("reauthentication freshness", () => {
  it("reads null as not fresh", () => {
    const context = {
      session: { reauthenticationFreshUntil: null },
    } as SessionContext

    expect(reauthenticationFreshUntil(context)).toBeNull()
    expect(isReauthenticationFresh(null)).toBe(false)
    expect(isSessionReauthenticationFresh(context)).toBe(false)
  })

  it("reads an absent field as not fresh", () => {
    const context = { session: {} } as SessionContext

    expect(reauthenticationFreshUntil(context)).toBeUndefined()
    expect(isReauthenticationFresh(undefined)).toBe(false)
    expect(isSessionReauthenticationFresh(context)).toBe(false)
  })

  it("re-evaluates the instant on each check rather than caching a boolean", () => {
    const now = new Date("2026-06-01T12:00:00.000Z")

    expect(isReauthenticationFresh(future, now)).toBe(true)
    expect(isReauthenticationFresh(past, now)).toBe(false)
    expect(isReauthenticationFresh("2026-06-01T12:00:01.000Z", now)).toBe(true)
    expect(isReauthenticationFresh("2026-06-01T11:59:59.000Z", now)).toBe(false)
  })
})
