import { describe, expect, it } from "vitest"

import {
  type StoredSession,
  accessTokenNeedsRefresh,
  clearSession,
  readSession,
  writeSession,
} from "@/lib/auth/session-broker"
import { SESSION_COOKIE_BASE, boundedSlotNames } from "@/lib/auth/session-cookies"
import { SESSION_POLICY } from "@/lib/auth/session-policy"

const NOW = 1_800_000_000

const session = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  accessToken: "access-token-fixture",
  refreshToken: "refresh-token-fixture",
  providerSessionId: "00000000-0000-4000-8000-000000000001",
  accessTokenExpiresAt: NOW + SESSION_POLICY.jwtLifetimeSeconds,
  absoluteExpiresAt: NOW + SESSION_POLICY.absoluteSessionSeconds,
  ...overrides,
})

const applied = (instructions: { name: string; value: string; maxAge: number }[]) => {
  const jar: Record<string, string> = {}
  for (const instruction of instructions) {
    if (instruction.maxAge === 0) {
      delete jar[instruction.name]
      continue
    }
    jar[instruction.name] = instruction.value
  }
  return jar
}

describe("server-only session broker", () => {
  it("round-trips a session through the cookie jar", () => {
    const original = session()
    const jar = applied(writeSession(original, NOW))

    expect(readSession(jar, NOW)).toEqual({
      status: "active",
      session: original,
      generation: expect.any(String),
    })
  })

  it("reports anonymous when no session cookie exists", () => {
    expect(readSession({}, NOW)).toEqual({ status: "anonymous" })
  })

  it("never exposes a token through a cookie name", () => {
    const instructions = writeSession(session(), NOW)

    for (const instruction of instructions) {
      expect(instruction.name).not.toContain("access")
      expect(instruction.name).not.toContain("token")
      expect(instruction.name.startsWith("__Host-")).toBe(true)
    }
  })

  it("clears every bounded slot before writing, so no stale chunk survives", () => {
    const instructions = writeSession(session(), NOW)
    const cleared = instructions.filter((instruction) => instruction.maxAge === 0)

    expect(cleared.map(({ name }) => name)).toEqual(
      boundedSlotNames(SESSION_COOKIE_BASE),
    )
    // Clears precede writes, otherwise the write would be deleted again.
    expect(
      instructions.indexOf(
        cleared[cleared.length - 1] as (typeof instructions)[number],
      ),
    ).toBeLessThan(instructions.findIndex((instruction) => instruction.maxAge > 0))
  })

  it("rotates to a new generation on every write", () => {
    const first = readSession(applied(writeSession(session(), NOW)), NOW)
    const second = readSession(applied(writeSession(session(), NOW)), NOW)

    expect(first.status).toBe("active")
    expect(second.status).toBe("active")
    if (first.status !== "active" || second.status !== "active") return
    expect(first.generation).not.toBe(second.generation)
  })

  it("caps cookie lifetime at the frozen absolute session", () => {
    const written = writeSession(
      session({ absoluteExpiresAt: NOW + SESSION_POLICY.absoluteSessionSeconds * 10 }),
      NOW,
    )
    const live = written.filter((instruction) => instruction.maxAge > 0)

    for (const instruction of live) {
      expect(instruction.maxAge).toBeLessThanOrEqual(
        SESSION_POLICY.absoluteSessionSeconds,
      )
    }
  })

  it("rejects an expired absolute session and demands a clear", () => {
    const jar = applied(writeSession(session(), NOW))
    const outcome = readSession(jar, NOW + SESSION_POLICY.absoluteSessionSeconds + 1)

    expect(outcome.status).toBe("rejected")
    if (outcome.status !== "rejected") return
    expect(outcome.reason).toBe("expired")
    expect(outcome.clear.map(({ name }) => name)).toEqual(
      boundedSlotNames(SESSION_COOKIE_BASE),
    )
  })

  it("rejects a structurally valid cookie carrying a malformed session", () => {
    const jar = applied(writeSession(session(), NOW))
    const firstChunk = `${SESSION_COOKIE_BASE}.0`
    const value = jar[firstChunk] as string
    // Keep the chunk framing intact and corrupt only the encoded body.
    jar[firstChunk] = `${value.slice(0, 13)}Zm9vYmFy`
    for (const index of [1, 2, 3]) delete jar[`${SESSION_COOKIE_BASE}.${index}`]

    const outcome = readSession(jar, NOW)

    expect(outcome.status).toBe("rejected")
    if (outcome.status !== "rejected") return
    expect(["malformed-session", "missing-chunk"]).toContain(outcome.reason)
    expect(outcome.clear).not.toHaveLength(0)
  })

  it("carries a clear instruction on every rejection", () => {
    const jars: Record<string, string>[] = [
      { [SESSION_COOKIE_BASE]: "legacy-unchunked" },
      { [`${SESSION_COOKIE_BASE}.0`]: "garbage" },
      { ...applied(writeSession(session(), NOW)), [SESSION_COOKIE_BASE]: "collision" },
    ]

    for (const jar of jars) {
      const outcome = readSession(jar, NOW)

      expect(outcome.status).toBe("rejected")
      if (outcome.status !== "rejected") continue
      expect(outcome.clear.map(({ name }) => name)).toEqual(
        boundedSlotNames(SESSION_COOKIE_BASE),
      )
      for (const instruction of outcome.clear) {
        expect(instruction.maxAge).toBe(0)
      }
    }
  })

  it("clears every slot on logout", () => {
    expect(clearSession().map(({ name }) => name)).toEqual(
      boundedSlotNames(SESSION_COOKIE_BASE),
    )
  })

  it("asks for a refresh only inside the final minute of the access token", () => {
    expect(accessTokenNeedsRefresh(session(), NOW)).toBe(false)
    expect(
      accessTokenNeedsRefresh(session({ accessTokenExpiresAt: NOW + 61 }), NOW),
    ).toBe(false)
    expect(
      accessTokenNeedsRefresh(session({ accessTokenExpiresAt: NOW + 60 }), NOW),
    ).toBe(true)
    expect(
      accessTokenNeedsRefresh(session({ accessTokenExpiresAt: NOW - 1 }), NOW),
    ).toBe(true)
  })

  it("keeps one principal's cookies from reconstructing another's session", () => {
    const first = applied(writeSession(session({ accessToken: "first" }), NOW))
    const second = applied(writeSession(session({ accessToken: "second" }), NOW))
    // Splice one chunk from the other principal's generation.
    const swapped = {
      ...first,
      [`${SESSION_COOKIE_BASE}.1`]: second[`${SESSION_COOKIE_BASE}.1`] as string,
    }

    const outcome = readSession(swapped, NOW)

    expect(outcome.status).toBe("rejected")
    if (outcome.status !== "rejected") return
    expect(outcome.reason).toBe("mixed-generation")
  })
})
