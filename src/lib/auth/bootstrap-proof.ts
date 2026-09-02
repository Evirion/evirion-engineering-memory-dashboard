import "server-only"

/**
 * The one-time signed proof the BFF sends with a session bootstrap.
 *
 * A valid Supabase bearer token alone must not create a session, so the
 * backend additionally requires this proof. It binds issuer, audience, method
 * and path, a digest of the exact token, the verified principal and session,
 * the pre-auth transaction, any invitation selection, a nonce, its lifetime,
 * the idempotency key and a digest of the canonical request body.
 *
 * A service-role key, an Origin header, CORS or any unsigned header is never
 * accepted as this proof. It cannot be minted by a browser.
 */

const encoder = new TextEncoder()

export const BOOTSTRAP_PROOF_ISSUER = "evirion-console-bff"
export const BOOTSTRAP_PROOF_AUDIENCE = "evirion-console-backend"
export const BOOTSTRAP_PROOF_LIFETIME_SECONDS = 120

export type BootstrapProofClaims = {
  readonly iss: string
  readonly aud: string
  readonly method: string
  readonly path: string
  readonly tokenDigest: string
  readonly sub: string
  readonly sessionId: string
  readonly preAuthTransactionId: string
  readonly invitationId: string | null
  readonly nonce: string
  readonly iat: number
  readonly exp: number
  readonly idempotencyKey: string
  readonly bodyDigest: string
}

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export const importProofKey = async (secret: string): Promise<CryptoKey> => {
  const raw = encoder.encode(secret)
  if (raw.length * 8 < 256) {
    throw new Error("bootstrap proof signing key must be at least 256 bits")
  }
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ])
}

export const createProofNonce = (): string => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("base64url")
}

export type BootstrapProofInput = {
  readonly accessToken: string
  readonly method: string
  readonly path: string
  readonly subject: string
  readonly sessionId: string
  readonly preAuthTransactionId: string
  readonly invitationId: string | null
  readonly idempotencyKey: string
  readonly body: string
  readonly issuedAt: number
}

export const signBootstrapProof = async (
  key: CryptoKey,
  input: BootstrapProofInput,
): Promise<{ proof: string; claims: BootstrapProofClaims }> => {
  const claims: BootstrapProofClaims = {
    iss: BOOTSTRAP_PROOF_ISSUER,
    aud: BOOTSTRAP_PROOF_AUDIENCE,
    method: input.method.toUpperCase(),
    path: input.path,
    tokenDigest: await sha256Hex(input.accessToken),
    sub: input.subject,
    sessionId: input.sessionId,
    preAuthTransactionId: input.preAuthTransactionId,
    invitationId: input.invitationId,
    nonce: createProofNonce(),
    iat: input.issuedAt,
    exp: input.issuedAt + BOOTSTRAP_PROOF_LIFETIME_SECONDS,
    idempotencyKey: input.idempotencyKey,
    bodyDigest: await sha256Hex(input.body),
  }

  const body = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url")
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body))

  return {
    proof: `${body}.${Buffer.from(new Uint8Array(signature)).toString("base64url")}`,
    claims,
  }
}
