import type { SessionContext } from "@contracts/console"

/**
 * Whether a session currently satisfies the backend's recent-reauthentication
 * requirement.
 *
 * The value is an instant rather than a boolean so callers can reason about
 * time remaining on each check. Do not compute once and cache the result: the
 * window closes while a page is open.
 */

export const reauthenticationFreshUntil = (
  context: SessionContext,
): string | null | undefined => context.session?.reauthenticationFreshUntil

export const isReauthenticationFresh = (
  freshUntil: string | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (freshUntil === undefined || freshUntil === null) return false
  const instant = Date.parse(freshUntil)
  if (Number.isNaN(instant)) return false
  return instant > now.getTime()
}

export const isSessionReauthenticationFresh = (
  context: SessionContext,
  now: Date = new Date(),
): boolean => isReauthenticationFresh(reauthenticationFreshUntil(context), now)
