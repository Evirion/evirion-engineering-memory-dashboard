/**
 * The Auth/session and cookie numbers EEM-9/01 froze.
 *
 * Every value here mirrors `docs/architecture/toolchain-baseline.json`. None of
 * them is a default, a guess or a rounded figure, and
 * `tests/contract/session-policy.test.ts` asserts the mirror stays exact.
 */

const SECOND = 1
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

export const SESSION_POLICY = {
  /** `jwtLifetime: "15m"` */
  jwtLifetimeSeconds: 15 * MINUTE,
  /** `absoluteApplicationSession: "8h"` */
  absoluteSessionSeconds: 8 * HOUR,
  /** `idleExpiry: "30m-visible-tab-human-activity"` */
  idleExpirySeconds: 30 * MINUTE,
  /** `idleWarning: "5m"`, shown before idle expiry, not after it. */
  idleWarningSeconds: 5 * MINUTE,
  /** `emailOtpLifetime: "10m"` */
  emailOtpLifetimeSeconds: 10 * MINUTE,
  /** `otpResendCooldown: "60s"` */
  otpResendCooldownSeconds: 60 * SECOND,
  /** `dangerousOperationReauthentication: "10m"` */
  reauthenticationSeconds: 10 * MINUTE,
  /** `concurrentSessionMaximum: 3`; a fourth replaces the oldest with notice. */
  concurrentSessionMaximum: 3,
  /** `oldestSessionReplacementNoticeRequired: true` */
  oldestSessionReplacementNoticeRequired: true,
  /** `touchCoalescing: "1m"`; the database still owns expiry. */
  touchCoalescingSeconds: 60 * SECOND,
} as const

export const COOKIE_BUDGET = {
  /** `logicalCookieChunkMaximum: 4` */
  chunkMaximum: 4,
  /** `logicalCookieChunkValueBytes: 3072` */
  chunkValueBytes: 3072,
  /** `aggregateRequestCookieHeaderBytes: 8192` */
  requestHeaderBytes: 8192,
  /** `aggregateResponseSetCookieHeaderBytes: 16384` */
  responseHeaderBytes: 16384,
} as const

/**
 * Activity that may extend an idle window. Asset loads, prefetch, polling
 * configured as non-activity and an untouched visible tab are excluded by the
 * frozen contract, and the backend is the authority regardless.
 */
export const HUMAN_ACTIVITY_REQUIRES_VISIBLE_TAB = true
