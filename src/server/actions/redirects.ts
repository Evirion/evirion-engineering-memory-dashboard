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

/** A one-time setup-intent state is 32 bytes of hex and nothing else. */
const SETUP_INTENT_STATE = /^[0-9a-f]{64}$/

export class GithubInstallRedirectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GithubInstallRedirectError"
  }
}

/**
 * The one destination the Console redirects to off-origin.
 *
 * Installing a GitHub App is a handoff to GitHub, so it cannot be expressed as
 * a same-origin path. The invariant `canonicalRedirect` exists to protect still
 * holds: the destination comes from reviewed configuration, never from request
 * input, and the only caller-influenced part is a state the backend issued and
 * this function refuses unless it is exactly a setup-intent nonce.
 */
export const githubInstallRedirect = (state: string): URL => {
  if (!SETUP_INTENT_STATE.test(state)) {
    throw new GithubInstallRedirectError("setup intent state is malformed")
  }

  const destination = new URL(readServerEnvironment().githubAppInstallUrl)
  destination.searchParams.set("state", state)
  return destination
}
