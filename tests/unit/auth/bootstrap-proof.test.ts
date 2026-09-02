import { beforeAll, describe, expect, it } from "vitest"

import {
  BOOTSTRAP_PROOF_AUDIENCE,
  BOOTSTRAP_PROOF_ISSUER,
  BOOTSTRAP_PROOF_LIFETIME_SECONDS,
  type BootstrapProofClaims,
  importProofKey,
  sha256Hex,
  signBootstrapProof,
} from "@/lib/auth/bootstrap-proof"

const KEY = "console-unit-test-signing-key-not-a-secret"
const NOW = 1_800_000_000

const input = {
  accessToken: "caller-access-token",
  method: "post",
  path: "/internal/console/v1/session/bootstrap",
  subject: "00000000-0000-4000-8000-000000000001",
  sessionId: "00000000-0000-4000-8000-000000000002",
  preAuthTransactionId: "txn-1",
  invitationId: null,
  idempotencyKey: "bootstrap:session-2",
  body: '{"invitationId":null}',
  issuedAt: NOW,
}

const decode = (proof: string): BootstrapProofClaims =>
  JSON.parse(
    Buffer.from(proof.slice(0, proof.lastIndexOf(".")), "base64url").toString("utf8"),
  ) as BootstrapProofClaims

describe("one-time bootstrap proof", () => {
  let key: CryptoKey

  beforeAll(async () => {
    key = await importProofKey(KEY)
  })

  it("requires at least 256 bits of signing entropy", async () => {
    await expect(importProofKey("short")).rejects.toThrow(/256 bits/)
  })

  it("binds issuer, audience, method and path", async () => {
    const { claims } = await signBootstrapProof(key, input)

    expect(claims.iss).toBe(BOOTSTRAP_PROOF_ISSUER)
    expect(claims.aud).toBe(BOOTSTRAP_PROOF_AUDIENCE)
    expect(claims.method).toBe("POST")
    expect(claims.path).toBe("/internal/console/v1/session/bootstrap")
  })

  it("binds a digest of the exact token rather than the token", async () => {
    const { proof, claims } = await signBootstrapProof(key, input)

    expect(claims.tokenDigest).toBe(await sha256Hex(input.accessToken))
    // The proof must never carry the bearer it authenticates.
    expect(proof).not.toContain(input.accessToken)
    expect(JSON.stringify(claims)).not.toContain(input.accessToken)
  })

  it("binds the principal, the session and the pre-auth transaction", async () => {
    const { claims } = await signBootstrapProof(key, input)

    expect(claims.sub).toBe(input.subject)
    expect(claims.sessionId).toBe(input.sessionId)
    expect(claims.preAuthTransactionId).toBe(input.preAuthTransactionId)
  })

  it("binds the idempotency key and a digest of the canonical body", async () => {
    const { claims } = await signBootstrapProof(key, input)

    expect(claims.idempotencyKey).toBe(input.idempotencyKey)
    expect(claims.bodyDigest).toBe(await sha256Hex(input.body))
  })

  it("carries a distinct nonce and a bounded lifetime every time", async () => {
    const signed = await Promise.all(
      Array.from({ length: 8 }, async () => signBootstrapProof(key, input)),
    )
    const nonces = signed.map(({ claims }) => claims.nonce)

    expect(new Set(nonces).size).toBe(8)
    for (const { claims } of signed) {
      expect(claims.exp - claims.iat).toBe(BOOTSTRAP_PROOF_LIFETIME_SECONDS)
    }
  })

  it("produces a different signature for a different body", async () => {
    const first = await signBootstrapProof(key, input)
    const second = await signBootstrapProof(key, {
      ...input,
      body: '{"invitationId":"other"}',
    })

    expect(decode(first.proof).bodyDigest).not.toBe(decode(second.proof).bodyDigest)
  })

  it("produces a different signature under a different key", async () => {
    const other = await importProofKey("console-unit-test-other-key-not-a-secret-b")
    const a = await signBootstrapProof(key, input)
    const b = await signBootstrapProof(other, input)

    expect(a.proof.split(".")[1]).not.toBe(b.proof.split(".")[1])
  })
})
