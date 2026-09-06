import { beforeAll, describe, expect, it, vi } from "vitest"

import {
  PRE_AUTH_ADDRESS_COOKIE,
  preAuthCookieNames,
} from "@/lib/auth/pre-auth-cookies"

/**
 * The sealed address is a recorded departure, so it gets checked rather than
 * trusted.
 *
 * Every other layer holds only the HMAC of the address, and the accepted
 * requirements bind the pre-auth proof to that HMAC. This cookie is additive
 * and authorises nothing; it exists only so the verify page can fill in the
 * address the reader already typed. What it must not do is leak in a form
 * anyone but this server can read, or survive a sign-out.
 */

vi.mock("next/headers", () => ({ cookies: async () => new Map() }))
vi.mock("@/lib/env/server", () => ({
  readServerEnvironment: () => ({ csrfSigningKey: "a".repeat(48) }),
}))

let sealEmailAddress: (email: string) => Promise<string>

beforeAll(async () => {
  ;({ sealEmailAddress } = await import("@/server/actions/pre-auth"))
})

describe("the sealed pre-auth address", () => {
  it("is cleared with the rest of the pre-auth state", () => {
    // A sign-out that left it behind would keep disclosing the address after
    // the transaction it belonged to had ended.
    expect(preAuthCookieNames).toContain(PRE_AUTH_ADDRESS_COOKIE)
  })

  it("is host-only and unreadable by name alone", () => {
    expect(PRE_AUTH_ADDRESS_COOKIE.startsWith("__Host-")).toBe(true)
  })

  it("never stores the address in a readable form", async () => {
    const sealed = await sealEmailAddress("Partner@Example.COM")

    expect(sealed).not.toContain("Partner")
    expect(sealed).not.toContain("example.com")
    expect(sealed).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("produces a different sealed value every time", async () => {
    // A deterministic seal would let an observer match two transactions to the
    // same address without ever reading it.
    const first = await sealEmailAddress("partner@example.com")
    const second = await sealEmailAddress("partner@example.com")

    expect(first).not.toEqual(second)
  })

  it("carries enough length for a nonce and an authentication tag", async () => {
    const sealed = await sealEmailAddress("a@b.co")
    const packed = Buffer.from(sealed, "base64url")

    // 12 bytes of nonce, 16 of GCM tag, and the address itself. Anything
    // shorter would mean one of the three is missing.
    expect(packed.length).toBeGreaterThan(12 + 16)
  })
})
