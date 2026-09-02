import { beforeAll, describe, expect, it } from "vitest"

import {
  type CsrfBinding,
  CsrfKeyError,
  importCsrfKey,
  issueCsrfToken,
  verifyCsrfToken,
} from "@/lib/security/csrf"

// Deliberately low-entropy, self-describing fixtures. They sign nothing
// outside this suite and are not credentials for any environment.
const SECRET = "console-unit-test-signing-key-not-a-secret"
const OTHER_SECRET = "console-unit-test-other-key-not-a-secret-b"
const NOW = 1_800_000_000

const sessionBinding = (sessionId = "session-a"): CsrfBinding => ({
  kind: "session",
  sessionId,
})

const preAuthBinding = (
  overrides: Partial<Extract<CsrfBinding, { kind: "pre-auth" }>> = {},
) =>
  ({
    kind: "pre-auth",
    transactionId: "txn-1",
    emailIdentityHmac: "hmac-of-email",
    generation: 1,
    ...overrides,
  }) satisfies CsrfBinding

describe("HMAC double-submit CSRF proof", () => {
  let key: CryptoKey
  let otherKey: CryptoKey

  beforeAll(async () => {
    key = await importCsrfKey(SECRET)
    otherKey = await importCsrfKey(OTHER_SECRET)
  })

  it("requires at least 256 bits of signing entropy", async () => {
    await expect(importCsrfKey("too-short")).rejects.toThrow(CsrfKeyError)
  })

  it("accepts a matching cookie and submitted copy", async () => {
    const token = await issueCsrfToken(key, sessionBinding(), {
      issuedAt: NOW,
      lifetimeSeconds: 3600,
    })

    await expect(
      verifyCsrfToken(key, {
        cookieToken: token,
        submittedToken: token,
        expectedBinding: sessionBinding(),
        now: NOW,
      }),
    ).resolves.toEqual({ valid: true, binding: sessionBinding() })
  })

  it("mints a distinct token every time", async () => {
    const tokens = await Promise.all(
      Array.from({ length: 8 }, async () =>
        issueCsrfToken(key, sessionBinding(), { issuedAt: NOW, lifetimeSeconds: 3600 }),
      ),
    )

    expect(new Set(tokens).size).toBe(8)
  })

  it.each([
    ["absent cookie copy", { cookieToken: undefined }, "malformed"],
    ["absent submitted copy", { submittedToken: undefined }, "malformed"],
  ] as const)("rejects a %s", async (_label, override, reason) => {
    const token = await issueCsrfToken(key, sessionBinding(), {
      issuedAt: NOW,
      lifetimeSeconds: 3600,
    })

    await expect(
      verifyCsrfToken(key, {
        cookieToken: token,
        submittedToken: token,
        expectedBinding: sessionBinding(),
        now: NOW,
        ...override,
      }),
    ).resolves.toEqual({ valid: false, reason })
  })

  it("rejects a submitted copy that differs from the cookie copy", async () => {
    const cookieToken = await issueCsrfToken(key, sessionBinding(), {
      issuedAt: NOW,
      lifetimeSeconds: 3600,
    })
    const submittedToken = await issueCsrfToken(key, sessionBinding(), {
      issuedAt: NOW,
      lifetimeSeconds: 3600,
    })

    await expect(
      verifyCsrfToken(key, {
        cookieToken,
        submittedToken,
        expectedBinding: sessionBinding(),
        now: NOW,
      }),
    ).resolves.toEqual({ valid: false, reason: "double-submit-mismatch" })
  })

  it("rejects a token signed with another key", async () => {
    const token = await issueCsrfToken(otherKey, sessionBinding(), {
      issuedAt: NOW,
      lifetimeSeconds: 3600,
    })

    await expect(
      verifyCsrfToken(key, {
        cookieToken: token,
        submittedToken: token,
        expectedBinding: sessionBinding(),
        now: NOW,
      }),
    ).resolves.toEqual({ valid: false, reason: "bad-signature" })
  })

  it("rejects a tampered payload", async () => {
    const token = await issueCsrfToken(key, sessionBinding(), {
      issuedAt: NOW,
      lifetimeSeconds: 3600,
    })
    const [body, signature] = token.split(".")
    const forged = Buffer.from(
      JSON.stringify({
        b: sessionBinding("victim"),
        n: "x",
        iat: NOW,
        exp: NOW + 3600,
      }),
      "utf8",
    ).toString("base64url")
    const tampered = `${forged}.${signature}`

    expect(body).not.toBe(forged)
    await expect(
      verifyCsrfToken(key, {
        cookieToken: tampered,
        submittedToken: tampered,
        expectedBinding: sessionBinding("victim"),
        now: NOW,
      }),
    ).resolves.toEqual({ valid: false, reason: "bad-signature" })
  })

  it("rejects an expired proof", async () => {
    const token = await issueCsrfToken(key, sessionBinding(), {
      issuedAt: NOW,
      lifetimeSeconds: 60,
    })

    await expect(
      verifyCsrfToken(key, {
        cookieToken: token,
        submittedToken: token,
        expectedBinding: sessionBinding(),
        now: NOW + 61,
      }),
    ).resolves.toEqual({ valid: false, reason: "expired" })
  })

  it("refuses a proof minted for another session, which is session swapping", async () => {
    const token = await issueCsrfToken(key, sessionBinding("attacker-session"), {
      issuedAt: NOW,
      lifetimeSeconds: 3600,
    })

    await expect(
      verifyCsrfToken(key, {
        cookieToken: token,
        submittedToken: token,
        expectedBinding: sessionBinding("victim-session"),
        now: NOW,
      }),
    ).resolves.toEqual({ valid: false, reason: "binding-mismatch" })
  })

  it("refuses a pre-auth proof for a post-auth mutation, and the reverse", async () => {
    const preAuthToken = await issueCsrfToken(key, preAuthBinding(), {
      issuedAt: NOW,
      lifetimeSeconds: 600,
    })
    const sessionToken = await issueCsrfToken(key, sessionBinding(), {
      issuedAt: NOW,
      lifetimeSeconds: 3600,
    })

    await expect(
      verifyCsrfToken(key, {
        cookieToken: preAuthToken,
        submittedToken: preAuthToken,
        expectedBinding: sessionBinding(),
        now: NOW,
      }),
    ).resolves.toEqual({ valid: false, reason: "binding-mismatch" })

    await expect(
      verifyCsrfToken(key, {
        cookieToken: sessionToken,
        submittedToken: sessionToken,
        expectedBinding: preAuthBinding(),
        now: NOW,
      }),
    ).resolves.toEqual({ valid: false, reason: "binding-mismatch" })
  })

  it("refuses a pre-auth proof from a stale OTP generation", async () => {
    const token = await issueCsrfToken(key, preAuthBinding({ generation: 1 }), {
      issuedAt: NOW,
      lifetimeSeconds: 600,
    })

    await expect(
      verifyCsrfToken(key, {
        cookieToken: token,
        submittedToken: token,
        expectedBinding: preAuthBinding({ generation: 2 }),
        now: NOW,
      }),
    ).resolves.toEqual({ valid: false, reason: "binding-mismatch" })
  })

  it("refuses a pre-auth proof bound to another email identity", async () => {
    const token = await issueCsrfToken(
      key,
      preAuthBinding({ emailIdentityHmac: "hmac-of-attacker" }),
      { issuedAt: NOW, lifetimeSeconds: 600 },
    )

    await expect(
      verifyCsrfToken(key, {
        cookieToken: token,
        submittedToken: token,
        expectedBinding: preAuthBinding({ emailIdentityHmac: "hmac-of-victim" }),
        now: NOW,
      }),
    ).resolves.toEqual({ valid: false, reason: "binding-mismatch" })
  })

  it("refuses a proof that survived logout, because the binding no longer matches", async () => {
    const beforeLogout = await issueCsrfToken(key, sessionBinding("session-before"), {
      issuedAt: NOW,
      lifetimeSeconds: 3600,
    })

    await expect(
      verifyCsrfToken(key, {
        cookieToken: beforeLogout,
        submittedToken: beforeLogout,
        expectedBinding: sessionBinding("session-after-rotation"),
        now: NOW + 1,
      }),
    ).resolves.toEqual({ valid: false, reason: "binding-mismatch" })
  })

  it.each(["", "no-separator", "..", "a.!!!not-base64!!!"])(
    "rejects the malformed token %o",
    async (token) => {
      const result = await verifyCsrfToken(key, {
        cookieToken: token,
        submittedToken: token,
        expectedBinding: sessionBinding(),
        now: NOW,
      })

      expect(result.valid).toBe(false)
    },
  )
})
