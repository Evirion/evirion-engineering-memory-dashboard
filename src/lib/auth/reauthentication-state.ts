import "server-only"

import type {
  ReauthenticationActionClass,
  ReauthenticationGate,
} from "@/lib/auth/reauthentication-action-class"

/**
 * A mutation the customer was performing when freshness lapsed or the backend
 * refused with `REAUTHENTICATION_REQUIRED`.
 *
 * It lives in an HttpOnly cookie until the ceremony succeeds or the customer
 * abandons it. No challenge identifier, nonce or token belongs here.
 */

export type PendingMutation = {
  readonly returnPath: string
  readonly mutationPath: string
  readonly fields: Readonly<Record<string, string>>
  readonly gate: ReauthenticationGate
  readonly actionClass: ReauthenticationActionClass
  /** Session that paused the mutation; replay refuses a different principal. */
  readonly providerSessionId: string
  /** Milliseconds since the epoch when the pause expires. */
  readonly expiresAt: number
}

export type StoredChallenge = {
  readonly challengeId: string
  readonly actionClass: ReauthenticationActionClass
  readonly expiresAt: string
  readonly providerSessionId: string
}

export const PENDING_MUTATION_COOKIE = "__Host-console-reauth-pending"
export const CHALLENGE_COOKIE = "__Host-console-reauth-challenge"

export const MAX_AGE_SECONDS = 600

const encoder = new TextEncoder()

const toBase64Url = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64url")

const fromBase64Url = (value: string): ArrayBuffer => {
  const bytes = Buffer.from(value, "base64url")
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

const importKey = async (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )

const signPayload = async (key: CryptoKey, payload: string): Promise<string> => {
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return toBase64Url(new Uint8Array(signature))
}

const verifyPayload = async (
  key: CryptoKey,
  payload: string,
  signature: string,
): Promise<boolean> => {
  try {
    return crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      encoder.encode(payload),
    )
  } catch {
    return false
  }
}

const encodeSigned = async <T>(secret: string, value: T): Promise<string> => {
  const payload = toBase64Url(encoder.encode(JSON.stringify(value)))
  const signature = await signPayload(await importKey(secret), payload)
  return `${payload}.${signature}`
}

const decodeSigned = async <T>(
  secret: string,
  token: string | undefined,
): Promise<T | undefined> => {
  if (token === undefined || token === "") return undefined
  const separator = token.lastIndexOf(".")
  if (separator <= 0) return undefined
  const payload = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  const key = await importKey(secret)
  if (!(await verifyPayload(key, payload, signature))) return undefined
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T
  } catch {
    return undefined
  }
}

export const serializePendingMutation = async (
  secret: string,
  value: PendingMutation,
): Promise<string> => encodeSigned(secret, value)

export const readPendingMutation = async (
  secret: string,
  token: string | undefined,
  options?: {
    readonly providerSessionId?: string
    readonly now?: number
  },
): Promise<PendingMutation | undefined> => {
  const pending = await decodeSigned<PendingMutation>(secret, token)
  if (pending === undefined) return undefined

  const now = options?.now ?? Date.now()
  if (
    typeof pending.providerSessionId !== "string" ||
    pending.providerSessionId === "" ||
    typeof pending.expiresAt !== "number" ||
    !Number.isFinite(pending.expiresAt) ||
    pending.expiresAt <= now
  ) {
    return undefined
  }

  if (
    options?.providerSessionId !== undefined &&
    pending.providerSessionId !== options.providerSessionId
  ) {
    return undefined
  }

  return pending
}

export const serializeStoredChallenge = async (
  secret: string,
  value: StoredChallenge,
): Promise<string> => encodeSigned(secret, value)

export const readStoredChallenge = async (
  secret: string,
  token: string | undefined,
): Promise<StoredChallenge | undefined> => decodeSigned<StoredChallenge>(secret, token)

export const cookieOptions = (maxAge = MAX_AGE_SECONDS) =>
  ({
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }) as const

export const clearReauthenticationCookies = (): Array<{
  name: string
  value: string
  maxAge: 0
  httpOnly: true
  secure: true
  sameSite: "lax"
  path: "/"
}> => [
  { name: PENDING_MUTATION_COOKIE, value: "", ...cookieOptions(0), maxAge: 0 },
  { name: CHALLENGE_COOKIE, value: "", ...cookieOptions(0), maxAge: 0 },
]

export const formFieldsFrom = (form: FormData): Record<string, string> => {
  const fields: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") fields[key] = value
  }
  return fields
}

export const decodePendingMutation = async (
  secret: string,
  token: string | undefined,
): Promise<PendingMutation | undefined> => decodeSigned<PendingMutation>(secret, token)

export const pendingFromForm = ({
  returnPath,
  mutationPath,
  gate,
  actionClass,
  form,
  providerSessionId,
  expiresAt,
}: {
  returnPath: string
  mutationPath: string
  gate: ReauthenticationGate
  actionClass: ReauthenticationActionClass
  form: FormData
  providerSessionId: string
  expiresAt: number
}): PendingMutation => ({
  returnPath,
  mutationPath,
  gate,
  actionClass,
  fields: formFieldsFrom(form),
  providerSessionId,
  expiresAt,
})
