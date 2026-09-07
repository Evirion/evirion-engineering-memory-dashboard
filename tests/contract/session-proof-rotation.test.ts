import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { csrfBoundSessionId, importCsrfKey, issueCsrfToken } from "@/lib/security/csrf"

import { repositoryRoot } from "../support/source-tree"

/**
 * The post-authentication proof is bound to one provider session.
 *
 * A browser that signs in a second time keeps the cookie from the first, and
 * the proxy issued a replacement only when the cookie was **absent**. A
 * returning reader therefore carried a proof bound to a session they no longer
 * held, and every state-changing request was refused as forged. On the
 * deployed Console that showed up as a correct authenticator code landing back
 * on sign-in, with no factor challenge ever reaching the provider.
 *
 * The module's own description already promised rotation "whenever the session
 * identity changes". These tests hold the code to it.
 */

const key = await importCsrfKey("0123456789abcdef0123456789abcdef0123456789abcdef")

const proofFor = async (sessionId: string): Promise<string> =>
  issueCsrfToken(
    key,
    { kind: "session", sessionId },
    { issuedAt: Math.floor(Date.now() / 1000), lifetimeSeconds: 3600 },
  )

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8")

describe("a carried proof names the session it belongs to", () => {
  it("reports that session", async () => {
    const sessionId = "6f1a0f6c-0b7a-4f0e-9a1f-2c3d4e5f6a7b"
    expect(csrfBoundSessionId(await proofFor(sessionId))).toBe(sessionId)
  })

  it("distinguishes one session from another", async () => {
    const first = await proofFor("11111111-1111-4111-8111-111111111111")
    const second = "22222222-2222-4222-8222-222222222222"
    expect(csrfBoundSessionId(first)).not.toBe(second)
  })

  it("reports nothing for a proof it cannot read", () => {
    for (const token of [undefined, "", "not-a-token", "!!!.!!!", "a.b.c"]) {
      expect(csrfBoundSessionId(token)).toBeUndefined()
    }
  })

  it("reports nothing for a pre-auth proof, which binds no session", async () => {
    const preAuth = await issueCsrfToken(
      key,
      { kind: "pre-auth", transactionId: "t", emailIdentityHmac: "", generation: 1 },
      { issuedAt: Math.floor(Date.now() / 1000), lifetimeSeconds: 3600 },
    )
    expect(csrfBoundSessionId(preAuth)).toBeUndefined()
  })
})

describe("the proxy replaces a proof that names another session", () => {
  const proxy = source("src/proxy.ts")

  it("decides on the live session rather than on the cookie's presence", () => {
    expect(proxy).toContain("csrfBoundSessionId(")
    expect(proxy).toContain("session.session.providerSessionId")
    expect(proxy).not.toContain("!request.cookies.has(SESSION_CSRF_COOKIE)")
  })

  it("replaces the forwarded copy instead of appending a second one", () => {
    // Two cookies of the same name leave the page reading whichever the parser
    // reaches first, which is the stale one, so the fix would not be visible.
    expect(proxy).toContain("withCookie(")
  })
})
