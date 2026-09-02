/**
 * Per-response security headers.
 *
 * The Content-Security-Policy carries a fresh CSPRNG nonce for every response
 * and uses `strict-dynamic` so Next.js works without `unsafe-inline` or
 * `unsafe-eval` in production. A module-scope nonce would be reused across a
 * warm instance, so nothing here is cached.
 */

export const NONCE_HEADER = "x-console-nonce"

const NONCE_BYTES = 16

export const createNonce = (): string => {
  const bytes = new Uint8Array(NONCE_BYTES)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Development needs `unsafe-eval` for the React refresh runtime. Production
 * must never carry it, and the release-surface suite asserts that.
 */
export const buildContentSecurityPolicy = (
  nonce: string,
  { isProduction }: { isProduction: boolean },
): string => {
  const scriptSource = isProduction
    ? `'nonce-${nonce}' 'strict-dynamic'`
    : `'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`

  return [
    "default-src 'none'",
    `script-src ${scriptSource}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ")
}

export type SecurityHeaderOptions = {
  readonly nonce: string
  readonly isProduction: boolean
}

/**
 * Every authenticated and nonce-bearing response is `private, no-store`, and
 * every route is force-dynamic, so no tenant state can enter a shared cache.
 */
export const buildSecurityHeaders = ({
  nonce,
  isProduction,
}: SecurityHeaderOptions): Record<string, string> => ({
  "Content-Security-Policy": buildContentSecurityPolicy(nonce, { isProduction }),
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": [
    "accelerometer=()",
    "camera=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "payment=()",
    "usb=()",
    "interest-cohort=()",
  ].join(", "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
})
