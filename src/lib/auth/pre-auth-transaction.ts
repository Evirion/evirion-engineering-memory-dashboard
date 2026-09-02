/**
 * The short-lived pre-auth transaction that carries OTP request, OTP verify
 * and bootstrap selection before a provider `session_id` exists.
 *
 * Two rules shape every transition. A lost response is recorded as an unknown
 * outcome and never retried automatically, because the provider accepts no
 * application idempotency key and a blind retry could send or consume a second
 * code. And an unknown outcome is never rendered or treated as success.
 */

export const PRE_AUTH_STATES = [
  "ISSUED",
  "OTP_REQUEST_STARTED",
  "OTP_REQUESTED",
  "OTP_VERIFY_STARTED",
  "OTP_VERIFIED",
  "BOOTSTRAP_PENDING",
  "CONSUMED",
  "OUTCOME_UNKNOWN",
  "VERIFY_OUTCOME_UNKNOWN",
  "REVOKED",
  "EXPIRED",
  "FAILED",
] as const

export type PreAuthState = (typeof PRE_AUTH_STATES)[number]

export const TERMINAL_PRE_AUTH_STATES: readonly PreAuthState[] = [
  "CONSUMED",
  "REVOKED",
  "EXPIRED",
  "FAILED",
  "VERIFY_OUTCOME_UNKNOWN",
]

export type PreAuthEvent =
  | "REQUEST_OTP"
  | "OTP_REQUEST_SUCCEEDED"
  | "OTP_REQUEST_RESPONSE_LOST"
  | "VERIFY_OTP"
  | "OTP_VERIFY_SUCCEEDED"
  | "OTP_VERIFY_RESPONSE_LOST"
  | "BOOTSTRAP_STARTED"
  | "BOOTSTRAP_COMMITTED"
  | "REVOKE"
  | "EXPIRE"
  | "FAIL"

export type PreAuthTransaction = {
  readonly transactionId: string
  readonly state: PreAuthState
  /** HMAC of the email identity; the address itself is never stored here. */
  readonly emailIdentityHmac: string
  /** Increments on every explicit resend, fencing every earlier code. */
  readonly generation: number
  readonly issuedAt: number
  readonly expiresAt: number
}

const TRANSITIONS: Readonly<
  Record<PreAuthState, Partial<Record<PreAuthEvent, PreAuthState>>>
> = {
  ISSUED: {
    REQUEST_OTP: "OTP_REQUEST_STARTED",
    REVOKE: "REVOKED",
    EXPIRE: "EXPIRED",
    FAIL: "FAILED",
  },
  OTP_REQUEST_STARTED: {
    OTP_REQUEST_SUCCEEDED: "OTP_REQUESTED",
    OTP_REQUEST_RESPONSE_LOST: "OUTCOME_UNKNOWN",
    REVOKE: "REVOKED",
    EXPIRE: "EXPIRED",
    FAIL: "FAILED",
  },
  OTP_REQUESTED: {
    VERIFY_OTP: "OTP_VERIFY_STARTED",
    REVOKE: "REVOKED",
    EXPIRE: "EXPIRED",
    FAIL: "FAILED",
  },
  OTP_VERIFY_STARTED: {
    OTP_VERIFY_SUCCEEDED: "OTP_VERIFIED",
    OTP_VERIFY_RESPONSE_LOST: "VERIFY_OUTCOME_UNKNOWN",
    REVOKE: "REVOKED",
    EXPIRE: "EXPIRED",
    FAIL: "FAILED",
  },
  OTP_VERIFIED: {
    BOOTSTRAP_STARTED: "BOOTSTRAP_PENDING",
    REVOKE: "REVOKED",
    EXPIRE: "EXPIRED",
    FAIL: "FAILED",
  },
  BOOTSTRAP_PENDING: {
    // A transient bootstrap failure retries from the server cookies without
    // repeating the OTP, so BOOTSTRAP_PENDING is deliberately re-enterable.
    BOOTSTRAP_STARTED: "BOOTSTRAP_PENDING",
    BOOTSTRAP_COMMITTED: "CONSUMED",
    REVOKE: "REVOKED",
    EXPIRE: "EXPIRED",
    FAIL: "FAILED",
  },
  // An unknown send outcome is never auto-retried. Only an explicit,
  // cooldown-bound resend moves it, and that creates the next generation.
  OUTCOME_UNKNOWN: {
    VERIFY_OTP: "OTP_VERIFY_STARTED",
    REVOKE: "REVOKED",
    EXPIRE: "EXPIRED",
    FAIL: "FAILED",
  },
  VERIFY_OUTCOME_UNKNOWN: {},
  CONSUMED: {},
  REVOKED: {},
  EXPIRED: {},
  FAILED: {},
}

export class PreAuthTransitionError extends Error {
  constructor(
    readonly from: PreAuthState,
    readonly event: PreAuthEvent,
  ) {
    super(`pre-auth transition ${from} -> ${event} is not permitted`)
    this.name = "PreAuthTransitionError"
  }
}

export const isTerminal = (state: PreAuthState): boolean =>
  TERMINAL_PRE_AUTH_STATES.includes(state)

export const nextPreAuthState = (
  state: PreAuthState,
  event: PreAuthEvent,
): PreAuthState | undefined => TRANSITIONS[state][event]

export const applyPreAuthEvent = (
  transaction: PreAuthTransaction,
  event: PreAuthEvent,
  now: number,
): PreAuthTransaction => {
  if (transaction.expiresAt <= now && event !== "EXPIRE") {
    throw new PreAuthTransitionError(transaction.state, event)
  }

  const next = nextPreAuthState(transaction.state, event)
  if (next === undefined) throw new PreAuthTransitionError(transaction.state, event)

  return { ...transaction, state: next }
}

/**
 * An explicit resend after the cooldown. It creates the next generation, which
 * fences every earlier code even if the provider would still verify one.
 */
export const resendPreAuthOtp = (
  transaction: PreAuthTransaction,
  {
    now,
    lastRequestedAt,
    cooldownSeconds,
  }: {
    now: number
    lastRequestedAt: number
    cooldownSeconds: number
  },
): PreAuthTransaction => {
  if (isTerminal(transaction.state)) {
    throw new PreAuthTransitionError(transaction.state, "REQUEST_OTP")
  }
  if (now - lastRequestedAt < cooldownSeconds) {
    throw new PreAuthTransitionError(transaction.state, "REQUEST_OTP")
  }

  return {
    ...transaction,
    state: "OTP_REQUEST_STARTED",
    generation: transaction.generation + 1,
  }
}

/**
 * Only the still-current generation may be reconciled from an unknown send to
 * a delivery confirmed by successful verification. A resend, revoke or expiry
 * fences the old code even when the provider itself would accept it.
 */
export const canReconcileDelivery = (
  transaction: PreAuthTransaction,
  verifiedGeneration: number,
): boolean =>
  transaction.state === "OUTCOME_UNKNOWN" &&
  transaction.generation === verifiedGeneration
