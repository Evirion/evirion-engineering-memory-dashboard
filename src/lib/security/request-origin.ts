/**
 * The origin, host, Fetch Metadata, content-type and trusted-proxy boundary
 * that every state-changing request must clear before any Auth, bootstrap or
 * domain effect.
 *
 * The deployment terminates TLS at exactly one trusted edge hop. That edge
 * strips inbound `Forwarded` and `X-Forwarded-*` and writes canonical values,
 * so the application may trust them only when the request arrived through the
 * configured proxy. A direct request is evaluated on its own `Host`.
 */

export const ALLOWED_CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
] as const

export type MutationRejection =
  | "method-not-allowed"
  | "missing-origin"
  | "origin-mismatch"
  | "host-mismatch"
  | "fetch-metadata-mismatch"
  | "content-type-not-allowed"
  | "untrusted-forwarding-header"

export type MutationOriginResult =
  | { readonly allowed: true; readonly origin: string }
  | { readonly allowed: false; readonly reason: MutationRejection }

export type MutationRequest = {
  readonly method: string
  readonly headers: Headers
  /** True only when the connection arrived from the configured proxy network. */
  readonly viaTrustedProxy: boolean
}

export type OriginPolicy = {
  readonly canonicalOrigin: string
  readonly trustedProxyHops: number
}

const FORWARDING_HEADERS = [
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-forwarded-for",
] as const

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

const rejected = (reason: MutationRejection): MutationOriginResult => ({
  allowed: false,
  reason,
})

const baseContentType = (value: string | null): string | undefined =>
  value?.split(";")[0]?.trim().toLowerCase()

/**
 * Derive the origin the client actually reached, honouring the edge only when
 * the request came through it.
 */
export const deriveEffectiveOrigin = (
  request: MutationRequest,
): { origin: string } | { forged: true } => {
  const present = FORWARDING_HEADERS.filter((name) => request.headers.has(name))

  if (!request.viaTrustedProxy) {
    // A client that sets these directly is attempting to choose its own
    // canonical identity, which is exactly what the edge exists to prevent.
    if (present.length > 0) return { forged: true }
    const host = request.headers.get("host")
    return host ? { origin: `https://${host}` } : { forged: true }
  }

  const protocol = request.headers.get("x-forwarded-proto") ?? "https"
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!host) return { forged: true }
  return { origin: `${protocol}://${host}` }
}

export const assertMutationOrigin = (
  request: MutationRequest,
  policy: OriginPolicy,
): MutationOriginResult => {
  if (!STATE_CHANGING_METHODS.has(request.method.toUpperCase())) {
    return rejected("method-not-allowed")
  }

  const effective = deriveEffectiveOrigin(request)
  if ("forged" in effective) return rejected("untrusted-forwarding-header")
  if (effective.origin !== policy.canonicalOrigin) return rejected("host-mismatch")

  // A null or absent Origin is not treated as same-origin. A cross-site form
  // post and a privacy-stripped request both land here and both are refused.
  const origin = request.headers.get("origin")
  if (origin === null) return rejected("missing-origin")
  if (origin !== policy.canonicalOrigin) return rejected("origin-mismatch")

  const site = request.headers.get("sec-fetch-site")
  if (site !== "same-origin") return rejected("fetch-metadata-mismatch")

  const mode = request.headers.get("sec-fetch-mode")
  if (mode !== null && !["cors", "same-origin", "navigate"].includes(mode)) {
    return rejected("fetch-metadata-mismatch")
  }

  const contentType = baseContentType(request.headers.get("content-type"))
  if (
    contentType === undefined ||
    !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)
  ) {
    return rejected("content-type-not-allowed")
  }

  return { allowed: true, origin: effective.origin }
}

/**
 * A redirect target must be a same-origin path. An absolute URL, a
 * protocol-relative URL, a backslash variant or a control character is
 * refused rather than normalized, so no redirect can leave the origin.
 */
export const resolveSafeRedirect = (candidate: string | null | undefined): string => {
  const fallback = "/"
  if (!candidate) return fallback
  if (!candidate.startsWith("/")) return fallback
  if (candidate.startsWith("//")) return fallback
  if (candidate.startsWith("/\\")) return fallback
  // Matching control characters is the point: a newline in a redirect target
  // is header injection, and a NUL can truncate a downstream comparison.
  // oxlint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(candidate)) return fallback
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) return fallback
  return candidate
}
