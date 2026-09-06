import { beforeAll, describe, expect, it } from "vitest"

import {
  BOOTSTRAP_PROOF_AUDIENCE,
  BOOTSTRAP_PROOF_ISSUER,
  BOOTSTRAP_PROOF_LIFETIME_SECONDS,
  type BootstrapSigningKey,
  canonicalSha256,
  importProofKey,
  sha256Hex,
  signBootstrapProof,
} from "@/lib/auth/bootstrap-proof"

const NOW = 1_800_000_000

/**
 * The backend verifies with `crypto.subtle` against a public JWK it selects by
 * `kid`, applying an exact-key check to both the header and the payload. These
 * cases mirror those checks rather than describing them, because the previous
 * suite passed against a proof the backend could never have accepted: it was
 * a two-segment HMAC blob with camelCase claims, and no bootstrap had ever
 * succeeded on staging.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const BACKEND_PAYLOAD_KEYS = [
  "aud",
  "exp",
  "iat",
  "idempotency_key",
  "invitation_id",
  "iss",
  "method",
  "nonce",
  "path",
  "pre_auth_id",
  "request_sha256",
  "session_id",
  "sub",
  "token_sha256",
].toSorted()

const BACKEND_PUBLIC_JWK_KEYS = [
  "alg",
  "crv",
  "ext",
  "key_ops",
  "kid",
  "kty",
  "use",
  "x",
].toSorted()

const generateKeyPair = async (
  kid: string,
): Promise<{ privateJwk: string; publicJwk: JsonWebKey & { kid: string } }> => {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey)
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey)
  return {
    privateJwk: JSON.stringify({ ...privateJwk, kid }),
    publicJwk: {
      alg: "EdDSA",
      crv: "Ed25519",
      ext: true,
      key_ops: ["verify"],
      kid,
      kty: "OKP",
      use: "sig",
      x: publicJwk.x,
    } as JsonWebKey & { kid: string },
  }
}

const decodeSegment = (value: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >

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

describe("one-time bootstrap proof", () => {
  let signingKey: BootstrapSigningKey
  let publicJwk: JsonWebKey & { kid: string }

  beforeAll(async () => {
    const pair = await generateKeyPair("console-test-key")
    signingKey = await importProofKey(pair.privateJwk)
    publicJwk = pair.publicJwk
  })

  it("refuses a key that is not an Ed25519 private JWK carrying a kid", async () => {
    await expect(importProofKey("not-json")).rejects.toThrow(/JWK/)
    await expect(
      importProofKey(JSON.stringify({ kty: "oct", k: "secret" })),
    ).rejects.toThrow(/Ed25519 private JWK/)
    const pair = await generateKeyPair("temporary")
    const withoutKid = JSON.parse(pair.privateJwk) as Record<string, unknown>
    delete withoutKid.kid
    // A key that cannot be named can be signed with and never verified.
    await expect(importProofKey(JSON.stringify(withoutKid))).rejects.toThrow(/kid/)
  })

  it("is a three-segment JWT whose header the backend accepts", async () => {
    const { proof } = await signBootstrapProof(signingKey, input)
    const segments = proof.split(".")

    expect(segments).toHaveLength(3)
    const header = decodeSegment(segments[0] as string)
    expect(Object.keys(header).toSorted()).toEqual(["alg", "kid", "typ"])
    expect(header).toMatchObject({ alg: "EdDSA", typ: "JWT", kid: "console-test-key" })
  })

  it("carries exactly the payload keys the backend allows", async () => {
    const { claims } = await signBootstrapProof(signingKey, input)

    // The backend applies an exact-key check, so an extra claim is a refusal.
    expect(Object.keys(claims).toSorted()).toEqual(BACKEND_PAYLOAD_KEYS)
  })

  it("verifies under the published public JWK", async () => {
    const { proof } = await signBootstrapProof(signingKey, input)
    const [header, payload, signature] = proof.split(".") as [string, string, string]

    expect(Object.keys(publicJwk).toSorted()).toEqual(BACKEND_PUBLIC_JWK_KEYS)
    const { kid: _kid, ...verifying } = publicJwk
    const key = await crypto.subtle.importKey(
      "jwk",
      verifying,
      { name: "Ed25519" },
      false,
      ["verify"],
    )
    const verified = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      Buffer.from(signature, "base64url"),
      new TextEncoder().encode(`${header}.${payload}`),
    )

    expect(verified).toBe(true)
  })

  it("binds issuer, audience, method and path", async () => {
    const { claims } = await signBootstrapProof(signingKey, input)

    expect(claims.iss).toBe(BOOTSTRAP_PROOF_ISSUER)
    expect(claims.aud).toBe(BOOTSTRAP_PROOF_AUDIENCE)
    expect(claims.method).toBe("POST")
    expect(claims.path).toBe("/internal/console/v1/session/bootstrap")
  })

  it("binds a digest of the exact token rather than the token", async () => {
    const { proof, claims } = await signBootstrapProof(signingKey, input)

    expect(claims.token_sha256).toBe(await sha256Hex(input.accessToken))
    expect(proof).not.toContain(input.accessToken)
    expect(JSON.stringify(claims)).not.toContain(input.accessToken)
  })

  it("binds the principal, the session and the pre-auth transaction", async () => {
    const { claims } = await signBootstrapProof(signingKey, input)

    expect(claims.sub).toBe(input.subject)
    expect(claims.session_id).toBe(input.sessionId)
    expect(claims.pre_auth_id).toBe(input.preAuthTransactionId)
    expect(claims.idempotency_key).toBe(input.idempotencyKey)
  })

  it("hashes the body with sorted keys, as the backend does", async () => {
    // The parity that was true by luck. Both real bodies carry one key, so
    // insertion order and sorted order agreed; a two-key body in the other
    // order would have broken sign-in with nothing to say why.
    const unsorted = { zebra: "last", alpha: "first" }
    const sorted = { alpha: "first", zebra: "last" }

    const { claims } = await signBootstrapProof(signingKey, {
      ...input,
      body: unsorted,
    })

    expect(claims.request_sha256).toBe(await canonicalSha256(sorted))
    expect(claims.request_sha256).toBe(
      await sha256Hex(JSON.stringify({ alpha: "first", zebra: "last" })),
    )
    expect(claims.request_sha256).not.toBe(await sha256Hex(JSON.stringify(unsorted)))
  })

  it("carries a UUID nonce, which the backend requires", async () => {
    const signed = await Promise.all(
      Array.from({ length: 8 }, async () => signBootstrapProof(signingKey, input)),
    )
    const nonces = signed.map(({ claims }) => claims.nonce)

    expect(new Set(nonces).size).toBe(8)
    for (const nonce of nonces) expect(nonce).toMatch(UUID)
  })

  it("stays inside the lifetime the backend accepts", async () => {
    const { claims } = await signBootstrapProof(signingKey, input)

    expect(claims.exp - claims.iat).toBe(BOOTSTRAP_PROOF_LIFETIME_SECONDS)
    // The backend refuses anything longer, so equality here is the boundary.
    expect(BOOTSTRAP_PROOF_LIFETIME_SECONDS).toBeLessThanOrEqual(120)
  })

  it("does not verify under a different key", async () => {
    const other = await generateKeyPair("other-key")
    const otherKey = await importProofKey(other.privateJwk)
    const a = await signBootstrapProof(signingKey, input)
    const b = await signBootstrapProof(otherKey, input)

    expect(a.proof.split(".")[2]).not.toBe(b.proof.split(".")[2])
    expect(decodeSegment(b.proof.split(".")[0] as string).kid).toBe("other-key")
  })
})
