import "server-only"

import { readServerEnvironment } from "@/lib/env/server"
import { resolveSafeRedirect } from "@/lib/security/request-origin"

/**
 * Build a redirect target on the canonical origin.
 *
 * `request.url` must never be the base. Behind the trusted edge it carries the
 * internal upstream host, so a redirect derived from it silently leaves the
 * canonical origin and the browser refuses to follow it. Deriving the origin
 * from the reviewed configuration keeps every redirect same-origin no matter
 * how the request reached the application.
 */
export const canonicalRedirect = (path: string | null | undefined): URL =>
  new URL(resolveSafeRedirect(path), readServerEnvironment().canonicalOrigin)
