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
/**
 * The address itself, encrypted, so the verify page can fill it in.
 *
 * This is a deliberate and recorded departure. Every other layer holds only the
 * HMAC — the backend column is `email_hmac` and has no plaintext counterpart —
 * and the accepted requirements bind the pre-auth proof to an "HMAC email
 * identity". That binding is untouched: this cookie is additive and is never
 * what authorises anything.
 *
 * What it costs: a stolen pre-auth cookie now discloses the address, where
 * before it disclosed nothing. It is `__Host-`, `HttpOnly`, `Secure` and lives
 * only as long as a code, so the exposure needs the device or a broken TLS
 * session, but it is real and it is new.
 *
 * Accepted by the owner on 2026-09-06 for staging convenience, on the explicit
 * grounds that no partner data exists yet. It must be revisited before a real
 * design partner signs in; the alternative that keeps the property is a
 * server-side transaction store, which needs a backend column that does not
 * exist today.
 */
export const PRE_AUTH_ADDRESS_COOKIE = `${PRE_AUTH_COOKIE_BASE}-addr`

export const preAuthCookieNames = [
  PRE_AUTH_ADDRESS_COOKIE,
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
