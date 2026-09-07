import { SESSION_POLICY } from "@/lib/auth/session-policy"

/**
 * What the reader should be told about the idle window, from their own
 * activity clock.
 *
 * This mirrors the frozen policy so the Console can warn before the window
 * closes. It decides nothing: the database owns the deadline and refuses the
 * next request on its own clock whatever this says. Treating it as authority
 * would put a policy decision in the browser.
 */
export type IdleState = "active" | "warning" | "elapsed"

export const idleStateAt = (
  idleForSeconds: number,
  policy: {
    readonly idleExpirySeconds: number
    readonly idleWarningSeconds: number
  } = SESSION_POLICY,
): IdleState => {
  if (idleForSeconds >= policy.idleExpirySeconds) return "elapsed"
  if (idleForSeconds >= policy.idleExpirySeconds - policy.idleWarningSeconds) {
    return "warning"
  }
  return "active"
}

/** Whole minutes left before the window closes, never below one. */
export const minutesRemaining = (
  idleForSeconds: number,
  policy: { readonly idleExpirySeconds: number } = SESSION_POLICY,
): number => Math.max(1, Math.ceil((policy.idleExpirySeconds - idleForSeconds) / 60))

/**
 * Whether another heartbeat may be sent.
 *
 * The database refuses to extend a window it already extended within the
 * coalescing interval, so sending faster than that is pure waste.
 */
export const heartbeatIsDue = (
  secondsSinceLastHeartbeat: number,
  policy: { readonly touchCoalescingSeconds: number } = SESSION_POLICY,
): boolean => secondsSinceLastHeartbeat >= policy.touchCoalescingSeconds
