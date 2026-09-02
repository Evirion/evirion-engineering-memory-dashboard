import {
  type CookieInstruction,
  type SessionCookieRejection,
  SESSION_COOKIE_BASE,
  clearSessionCookies,
  createGeneration,
  parseSessionCookies,
  serializeSessionCookies,
} from "./session-cookies"
import { SESSION_POLICY } from "./session-policy"

/**
 * The server-only session broker.
 *
 * Tokens live in `__Host-` cookies and in a request-local value. Nothing here
 * is module-scoped: a warm instance that remembered a token or a tenant would
 * serve it to the next request. The browser never sees either token, which is
 * the fixed ASVS V10.1.1 boundary.
 */

export type StoredSession = {
  readonly accessToken: string
  readonly refreshToken: string
  /** Provider session identity; the backend registry is the authority. */
  readonly providerSessionId: string
  /** Seconds since the epoch at which the access token expires. */
  readonly accessTokenExpiresAt: number
  /** Seconds since the epoch at which the absolute session ends. */
  readonly absoluteExpiresAt: number
}

export type SessionReadOutcome =
  | { readonly status: "anonymous" }
  | {
      readonly status: "active"
      readonly session: StoredSession
      readonly generation: string
    }
  | {
      readonly status: "rejected"
      readonly reason: SessionCookieRejection | "expired" | "malformed-session"
      /** Every bounded slot must be cleared before the response is sent. */
      readonly clear: CookieInstruction[]
    }

const isStoredSession = (value: unknown): value is StoredSession => {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate["accessToken"] === "string" &&
    candidate["accessToken"].length > 0 &&
    typeof candidate["refreshToken"] === "string" &&
    candidate["refreshToken"].length > 0 &&
    typeof candidate["providerSessionId"] === "string" &&
    candidate["providerSessionId"].length > 0 &&
    typeof candidate["accessTokenExpiresAt"] === "number" &&
    Number.isFinite(candidate["accessTokenExpiresAt"]) &&
    typeof candidate["absoluteExpiresAt"] === "number" &&
    Number.isFinite(candidate["absoluteExpiresAt"])
  )
}

const encode = (session: StoredSession): string =>
  Buffer.from(JSON.stringify(session), "utf8").toString("base64url")

const decode = (payload: string): unknown => {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return undefined
  }
}

export const readSession = (
  cookies: Record<string, string>,
  now: number = Math.floor(Date.now() / 1000),
): SessionReadOutcome => {
  const parsed = parseSessionCookies(SESSION_COOKIE_BASE, cookies)

  switch (parsed.status) {
    case "absent":
      return { status: "anonymous" }
    case "rejected":
      return {
        status: "rejected",
        reason: parsed.reason,
        clear: clearSessionCookies(SESSION_COOKIE_BASE),
      }
    case "valid": {
      const decoded = decode(parsed.payload)
      if (!isStoredSession(decoded)) {
        return {
          status: "rejected",
          reason: "malformed-session",
          clear: clearSessionCookies(SESSION_COOKIE_BASE),
        }
      }
      // The database owns expiry for the application session; this only stops
      // the BFF from forwarding a token it already knows is dead.
      if (decoded.absoluteExpiresAt <= now) {
        return {
          status: "rejected",
          reason: "expired",
          clear: clearSessionCookies(SESSION_COOKIE_BASE),
        }
      }
      return { status: "active", session: decoded, generation: parsed.generation }
    }
    default: {
      const exhaustive: never = parsed
      throw new Error(`unsupported cookie state: ${JSON.stringify(exhaustive)}`)
    }
  }
}

/**
 * Write a session. Rotation always mints a new generation and always clears
 * every bounded slot first, so a longer prior session cannot leave a readable
 * chunk behind.
 */
export const writeSession = (
  session: StoredSession,
  now: number = Math.floor(Date.now() / 1000),
): CookieInstruction[] => {
  const maxAge = Math.max(
    0,
    Math.min(SESSION_POLICY.absoluteSessionSeconds, session.absoluteExpiresAt - now),
  )

  return [
    ...clearSessionCookies(SESSION_COOKIE_BASE),
    ...serializeSessionCookies(
      SESSION_COOKIE_BASE,
      encode(session),
      createGeneration(),
      maxAge,
    ),
  ]
}

export const clearSession = (): CookieInstruction[] =>
  clearSessionCookies(SESSION_COOKIE_BASE)

/** Refresh is due once the access token is inside its final minute. */
export const accessTokenNeedsRefresh = (
  session: StoredSession,
  now: number = Math.floor(Date.now() / 1000),
): boolean => session.accessTokenExpiresAt - now <= 60
