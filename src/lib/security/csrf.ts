/**
 * HMAC-signed double-submit CSRF proof.
 *
 * The proof is bound to the pre-auth transaction before a session exists and
 * to the live `session_id` afterwards, so a token minted in one context cannot
 * authorize a mutation in another. Signature checking is constant time, and
 * idempotency remains a separate control: a valid proof is permission to
 * attempt, never permission to repeat.
 */

const SIGNING_KEY_BITS = 256
const encoder = new TextEncoder()

export type CsrfBinding =
  | {
      readonly kind: "pre-auth"
      readonly transactionId: string
      readonly emailIdentityHmac: string
      readonly generation: number
    }
  | { readonly kind: "session"; readonly sessionId: string }

export type CsrfFailure =
  | "malformed"
  | "bad-signature"
  | "expired"
  | "binding-mismatch"
  | "double-submit-mismatch"

export type CsrfVerification =
  | { readonly valid: true; readonly binding: CsrfBinding }
  | { readonly valid: false; readonly reason: CsrfFailure }

export class CsrfKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CsrfKeyError"
  }
}

type CsrfPayload = {
  readonly b: CsrfBinding
  readonly n: string
  readonly iat: number
  readonly exp: number
}

const toBase64Url = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64url")

const fromBase64Url = (value: string): ArrayBuffer => {
  const bytes = Buffer.from(value, "base64url")
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

export const importCsrfKey = async (secret: string): Promise<CryptoKey> => {
  const raw = encoder.encode(secret)
  if (raw.length * 8 < SIGNING_KEY_BITS) {
    throw new CsrfKeyError(
      `CSRF signing key must be at least ${SIGNING_KEY_BITS} bits of entropy`,
    )
  }
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ])
}

export const createCsrfNonce = (): string => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

const canonicalBinding = (binding: CsrfBinding): string =>
  binding.kind === "pre-auth"
    ? `pre-auth:${binding.transactionId}:${binding.emailIdentityHmac}:${binding.generation}`
    : `session:${binding.sessionId}`

export const issueCsrfToken = async (
  key: CryptoKey,
  binding: CsrfBinding,
  { issuedAt, lifetimeSeconds }: { issuedAt: number; lifetimeSeconds: number },
): Promise<string> => {
  const payload: CsrfPayload = {
    b: binding,
    n: createCsrfNonce(),
    iat: issuedAt,
    exp: issuedAt + lifetimeSeconds,
  }
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
  return `${body}.${toBase64Url(new Uint8Array(signature))}`
}

const parsePayload = (body: string): CsrfPayload | undefined => {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
    if (typeof decoded !== "object" || decoded === null) return undefined
    const candidate = decoded as Record<string, unknown>
    if (
      typeof candidate["n"] !== "string" ||
      typeof candidate["iat"] !== "number" ||
      typeof candidate["exp"] !== "number" ||
      typeof candidate["b"] !== "object" ||
      candidate["b"] === null
    ) {
      return undefined
    }
    return decoded as CsrfPayload
  } catch {
    return undefined
  }
}

/**
 * Verify the signature, the lifetime, the exact binding, and that the header
 * or form copy equals the cookie copy. All four must hold.
 */
export const verifyCsrfToken = async (
  key: CryptoKey,
  {
    cookieToken,
    submittedToken,
    expectedBinding,
    now,
  }: {
    cookieToken: string | undefined
    submittedToken: string | undefined
    expectedBinding: CsrfBinding
    now: number
  },
): Promise<CsrfVerification> => {
  if (!cookieToken || !submittedToken) return { valid: false, reason: "malformed" }

  const cookieBytes = encoder.encode(cookieToken)
  const submittedBytes = encoder.encode(submittedToken)
  if (cookieBytes.length !== submittedBytes.length) {
    return { valid: false, reason: "double-submit-mismatch" }
  }
  let difference = 0
  for (let index = 0; index < cookieBytes.length; index += 1) {
    difference |= (cookieBytes[index] as number) ^ (submittedBytes[index] as number)
  }
  if (difference !== 0) return { valid: false, reason: "double-submit-mismatch" }

  const separator = cookieToken.lastIndexOf(".")
  if (separator <= 0) return { valid: false, reason: "malformed" }

  const body = cookieToken.slice(0, separator)
  const signature = cookieToken.slice(separator + 1)

  let verified: boolean
  try {
    verified = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      encoder.encode(body),
    )
  } catch {
    return { valid: false, reason: "malformed" }
  }
  if (!verified) return { valid: false, reason: "bad-signature" }

  const payload = parsePayload(body)
  if (!payload) return { valid: false, reason: "malformed" }
  if (payload.exp <= now) return { valid: false, reason: "expired" }

  if (canonicalBinding(payload.b) !== canonicalBinding(expectedBinding)) {
    return { valid: false, reason: "binding-mismatch" }
  }

  return { valid: true, binding: payload.b }
}
