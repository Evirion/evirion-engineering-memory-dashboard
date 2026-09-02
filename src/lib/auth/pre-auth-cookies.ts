import { COOKIE_ATTRIBUTES, PRE_AUTH_COOKIE_BASE } from "./session-cookies"
import { SESSION_POLICY } from "./session-policy"

/**
 * Pre-auth cookie names and minting, with no dependency on request context.
 *
 * A Server Component may not write a cookie, so the proxy mints these on the
 * way in and the page only reads them. Keeping the logic here means both
 * sides agree on names, attributes and lifetime.
 */

export const PRE_AUTH_CSRF_COOKIE = `${PRE_AUTH_COOKIE_BASE}-csrf`
export const PRE_AUTH_TRANSACTION_COOKIE = `${PRE_AUTH_COOKIE_BASE}-txn`
/** HMAC of the email identity the code was sent to, never the address. */
export const PRE_AUTH_EMAIL_COOKIE = `${PRE_AUTH_COOKIE_BASE}-eid`

export const preAuthCookieNames = [
  PRE_AUTH_CSRF_COOKIE,
  PRE_AUTH_EMAIL_COOKIE,
  PRE_AUTH_TRANSACTION_COOKIE,
] as const

export const createTransactionId = (): string => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("base64url")
}

export const preAuthCookieOptions = {
  ...COOKIE_ATTRIBUTES,
  maxAge: SESSION_POLICY.emailOtpLifetimeSeconds,
} as const

export const clearPreAuthCookies = () =>
  preAuthCookieNames.map((name) => ({
    name,
    value: "",
    ...COOKIE_ATTRIBUTES,
    maxAge: 0,
  }))
