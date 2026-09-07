/**
 * Where a reader who already holds a session belongs, if not where they asked.
 *
 * The guard was only ever written in one direction. `/auth/mfa/challenge` and
 * `/auth/mfa/enroll` check for a session because they need one; nothing
 * stopped a signed-in reader from walking back into sign-in or verify and
 * starting a second transaction against their own live session. The root page
 * had the same gap in reverse: its own comment said the Auth phase would
 * replace the placeholder with a redirect, and it never did.
 *
 * This is a pure decision so it can be tested without a server environment.
 * The proxy applies it, because it already reads the session for the CSRF
 * binding and is the one place every request passes through.
 */

/** Pages that exist to establish a session, so a live one makes them wrong. */
const PRE_AUTH_PATHS: ReadonlySet<string> = new Set([
  "/auth/sign-in",
  "/auth/verify",
  "/auth/invite",
  "/auth/recovery",
])

/** The placeholder root, which is not a customer surface for a member. */
const PLACEHOLDER_ROOT = "/"

const LANDING = "/onboarding"

/** Where a session that has not yet proved a second factor has to go. */
const SECOND_FACTOR = "/auth/mfa/enroll"

/**
 * The pages that complete the second factor, plus the route handlers they post
 * to. Sending either of these to the second factor would be a loop, and a form
 * POST carries `sec-fetch-mode: navigate` exactly like a page visit, so the
 * route handlers have to be named here rather than assumed to be fetches.
 */
const isSecondFactorPath = (pathname: string): boolean =>
  pathname.startsWith("/auth/mfa/") ||
  pathname.startsWith("/api/auth/") ||
  pathname === "/auth/logout"

/**
 * Exact paths only. A prefix match would also capture `/auth/sign-in-elsewhere`
 * and, worse, `/auth/mfa/challenge`, which a signed-in reader must reach.
 *
 * Top-level navigations only, and this is not fussiness. Twenty-eight refusal
 * paths redirect to `/auth/sign-in`, and a `fetch` that follows one is not a
 * reader arriving at a door they should not be offered — it is the application
 * refusing something. Redirecting those onward would erase the refusal a
 * security test reads, and would tell the caller their forged request landed
 * somewhere ordinary.
 *
 * `sec-fetch-mode` is a forbidden header that page script cannot set, and this
 * codebase already trusts it in `request-origin.ts` for the origin boundary. A
 * client sending none keeps today's behaviour: this guard is a courtesy, not a
 * control, so it fails open by design.
 */
export const landingForAuthenticatedReader = (
  pathname: string,
  fetchMode: string | null,
  hasSecondFactor: boolean,
): string | undefined => {
  if (fetchMode !== "navigate") return undefined
  // A session established by an email code alone is real but powerless: the
  // backend creates it awaiting a second factor and refuses every read until
  // one arrives. Landing such a reader on the Console showed them a page that
  // could only fail, so they are sent to finish what they started instead.
  if (!hasSecondFactor) {
    return isSecondFactorPath(pathname) ? undefined : SECOND_FACTOR
  }
  return pathname === PLACEHOLDER_ROOT || PRE_AUTH_PATHS.has(pathname)
    ? LANDING
    : undefined
}
