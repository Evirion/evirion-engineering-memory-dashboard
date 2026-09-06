import "server-only"

/**
 * The one-time signed proof the BFF sends with a session bootstrap.
 *
 * A valid Supabase bearer token alone must not create a session, so the backend
 * additionally requires this proof. It binds issuer, audience, method and path,
 * a digest of the exact token, the verified principal and session, the pre-auth
 * transaction, any invitation selection, a nonce, its lifetime, the idempotency
 * key and a digest of the canonical request body.
 *
 * A service-role key, an Origin header, CORS or any unsigned header is never
 * accepted as this proof. It cannot be minted by a browser.
 *
 * **This module was rewritten on 2026-09-06 because none of that was true in
 * practice.** It produced a two-segment HMAC blob with camelCase claims; the
 * backend has always required a three-segment EdDSA JWT with a `kid`, a public
 * JWK to match it, and snake_case claims. No bootstrap had ever succeeded
 * against the real backend, and three staging sign-ins left zero rows in
 * `core.console_auth_sessions`. It survived because `tools/console-stub` did
 * not implement the route: the call 404'd, and a 404 was read as a transient
 * failure worth keeping the cookies for.
 *
 * Signing is asymmetric so the backend holds only a public key. A shared secret
 * would have to exist in two deployments at once, and the whole point of the
 * proof is that the backend can verify it without being able to mint it.
 */

const encoder = new TextEncoder()

/** The backend's defaults. Overriding either needs both sides changed. */
export const BOOTSTRAP_PROOF_ISSUER = "console-bff"
export const BOOTSTRAP_PROOF_AUDIENCE = "evirion-console-bootstrap"

/** The backend refuses `exp - iat` above this, so the two must agree exactly. */
export const BOOTSTRAP_PROOF_LIFETIME_SECONDS = 120

/**
 * Exactly the keys the backend accepts, and no others: it applies an exact-key
 * check, so an extra claim is a refusal rather than something ignored.
 */
export type BootstrapProofClaims = {
  readonly aud: string
  readonly exp: number
  readonly iat: number
  readonly idempotency_key: string
  readonly invitation_id: string | null
  readonly iss: string
  readonly method: string
  readonly nonce: string
  readonly path: string
  readonly pre_auth_id: string
  readonly request_sha256: string
  readonly session_id: string
  readonly sub: string
  readonly token_sha256: string
}

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Object keys sorted recursively, matching `canonicalValue` in the Edge
 * function.
 *
 * Both current bodies carry one key, so insertion order and sorted order agree
 * and the digests matched by luck. The first two-key body would have broken
 * sign-in with nothing in either repository to say why.
 */
const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .toSorted()
      .map((key) => [key, canonicalValue((value as Record<string, unknown>)[key])]),
  )
}

export const canonicalSha256 = async (value: unknown): Promise<string> =>
  sha256Hex(JSON.stringify(canonicalValue(value)))

export class BootstrapProofKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BootstrapProofKeyError"
  }
}

export type BootstrapSigningKey = {
  readonly key: CryptoKey
  /** Names the public JWK the backend must match. Without it, nothing verifies. */
  readonly kid: string
}

/**
 * Import the Ed25519 private JWK the deployment holds.
 *
 * The value is a JWK rather than raw bytes because the `kid` has to travel with
 * the key: the backend selects the verifying JWK by that identifier, so a key
 * without one can be signed with and never verified.
 */
export const importProofKey = async (secret: string): Promise<BootstrapSigningKey> => {
  let jwk: Record<string, unknown>
  try {
    jwk = JSON.parse(secret) as Record<string, unknown>
  } catch {
    throw new BootstrapProofKeyError("bootstrap proof signing key must be a JWK")
  }

  if (
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    typeof jwk.d !== "string" ||
    typeof jwk.x !== "string" ||
    typeof jwk.kid !== "string" ||
    jwk.kid.length < 1 ||
    jwk.kid.length > 128
  ) {
    throw new BootstrapProofKeyError(
      "bootstrap proof signing key must be an Ed25519 private JWK carrying a kid",
    )
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "OKP", crv: "Ed25519", d: jwk.d, x: jwk.x, key_ops: ["sign"], ext: false },
    { name: "Ed25519" },
    false,
    ["sign"],
  )
  return { key, kid: jwk.kid }
}

/** The backend requires a UUID here and refuses any other shape. */
export const createProofNonce = (): string => crypto.randomUUID()

export type BootstrapProofInput = {
  readonly accessToken: string
  readonly method: string
  readonly path: string
  readonly subject: string
  readonly sessionId: string
  readonly preAuthTransactionId: string
  readonly invitationId: string | null
  readonly idempotencyKey: string
  /** The body object. Canonicalisation belongs here, not at the call site. */
  readonly body: unknown
  readonly issuedAt: number
}

const segment = (value: unknown): string =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url")

export const signBootstrapProof = async (
  signingKey: BootstrapSigningKey,
  input: BootstrapProofInput,
): Promise<{ proof: string; claims: BootstrapProofClaims }> => {
  const claims: BootstrapProofClaims = {
    aud: BOOTSTRAP_PROOF_AUDIENCE,
    exp: input.issuedAt + BOOTSTRAP_PROOF_LIFETIME_SECONDS,
    iat: input.issuedAt,
    idempotency_key: input.idempotencyKey,
    invitation_id: input.invitationId,
    iss: BOOTSTRAP_PROOF_ISSUER,
    method: input.method.toUpperCase(),
    nonce: createProofNonce(),
    path: input.path,
    pre_auth_id: input.preAuthTransactionId,
    request_sha256: await canonicalSha256(input.body),
    session_id: input.sessionId,
    sub: input.subject,
    token_sha256: await sha256Hex(input.accessToken),
  }

  const signingInput = `${segment({
    alg: "EdDSA",
    kid: signingKey.kid,
    typ: "JWT",
  })}.${segment(claims)}`

  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    signingKey.key,
    encoder.encode(signingInput),
  )

  return {
    proof: `${signingInput}.${Buffer.from(new Uint8Array(signature)).toString("base64url")}`,
    claims,
  }
}
