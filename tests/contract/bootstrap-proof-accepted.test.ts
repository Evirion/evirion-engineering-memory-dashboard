import { beforeAll, describe, expect, it } from "vitest"

import {
  type BootstrapSigningKey,
  importProofKey,
  signBootstrapProof,
} from "@/lib/auth/bootstrap-proof"

// @ts-expect-error -- the double is plain JavaScript with no declarations.
import { describeBootstrapProofEnvelope } from "../../tools/console-stub/bootstrap-proof-envelope.mjs"

/**
 * The loop that was never closed.
 *
 * The Console signed a two-segment HMAC blob; the backend has always required a
 * three-segment EdDSA JWT. Nothing noticed, because `tools/console-stub` did
 * not implement the route: the call 404'd, the adapter called that transient,
 * and the cookies survived. Three staging sign-ins produced zero backend
 * sessions and every test still passed.
 *
 * These cases feed a proof this repository actually produces to the envelope
 * checks the Edge function actually applies. A double nothing exercises is the
 * same hazard as a double that checks nothing, so the checks live in a module
 * rather than inside the request handler.
 */

const NOW = Math.floor(Date.now() / 1000)

const input = {
  accessToken: "caller-access-token",
  method: "post",
  path: "/internal/console/v1/session/bootstrap",
  subject: "00000000-0000-4000-8000-000000000001",
  sessionId: "00000000-0000-4000-8000-000000000002",
  preAuthTransactionId: "00000000-0000-4000-8000-000000000003",
  invitationId: null,
  idempotencyKey: "00000000-0000-4000-8000-000000000004",
  body: { preAuthTransactionId: "00000000-0000-4000-8000-000000000003" },
  issuedAt: NOW,
}

const rebuild = (proof: string, mutate: (payload: Record<string, unknown>) => void) => {
  const [header, payload, signature] = proof.split(".") as [string, string, string]
  const claims = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as Record<string, unknown>
  mutate(claims)
  const rewritten = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url")
  return `${header}.${rewritten}.${signature}`
}

describe("a proof the Console produces is a proof the backend shape accepts", () => {
  let signingKey: BootstrapSigningKey

  beforeAll(async () => {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey)
    signingKey = await importProofKey(JSON.stringify({ ...jwk, kid: "loop-test-key" }))
  })

  it("is accepted", async () => {
    const { proof } = await signBootstrapProof(signingKey, input)

    expect(describeBootstrapProofEnvelope(proof)).toEqual({ ok: true })
  })

  it("refuses what the Console used to send", () => {
    // The exact former shape: two segments, no header, camelCase claims.
    const claims = Buffer.from(
      JSON.stringify({
        iss: "evirion-console-bff",
        tokenDigest: "x",
        nonce: "not-a-uuid",
      }),
      "utf8",
    ).toString("base64url")

    expect(describeBootstrapProofEnvelope(`${claims}.signature`)).toEqual({
      ok: false,
      reason: "not-a-jwt",
    })
  })

  it("refuses a missing proof and an undecodable one", () => {
    expect(describeBootstrapProofEnvelope(undefined).ok).toBe(false)
    expect(describeBootstrapProofEnvelope("a.b.c").ok).toBe(false)
  })

  it("refuses an extra claim, because the backend checks keys exactly", async () => {
    const { proof } = await signBootstrapProof(signingKey, input)
    const tampered = rebuild(proof, (claims) => {
      claims.extra = "unexpected"
    })

    expect(describeBootstrapProofEnvelope(tampered)).toEqual({
      ok: false,
      reason: "payload-keys",
    })
  })

  it("refuses a nonce that is not a UUID", async () => {
    const { proof } = await signBootstrapProof(signingKey, input)
    const tampered = rebuild(proof, (claims) => {
      claims.nonce = "AAAAAAAAAAAAAAAAAAAAAA"
    })

    expect(describeBootstrapProofEnvelope(tampered)).toEqual({
      ok: false,
      reason: "nonce",
    })
  })

  it("refuses a lifetime beyond the backend's bound", async () => {
    const { proof } = await signBootstrapProof(signingKey, input)
    const tampered = rebuild(proof, (claims) => {
      claims.exp = (claims.iat as number) + 121
    })

    expect(describeBootstrapProofEnvelope(tampered)).toEqual({
      ok: false,
      reason: "lifetime",
    })
  })
})
