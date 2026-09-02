import { describe, expect, it } from "vitest"

import {
  PRE_AUTH_STATES,
  type PreAuthState,
  type PreAuthTransaction,
  PreAuthTransitionError,
  applyPreAuthEvent,
  canReconcileDelivery,
  isTerminal,
  nextPreAuthState,
  resendPreAuthOtp,
} from "@/lib/auth/pre-auth-transaction"
import { SESSION_POLICY } from "@/lib/auth/session-policy"

const NOW = 1_800_000_000

const transaction = (
  overrides: Partial<PreAuthTransaction> = {},
): PreAuthTransaction => ({
  transactionId: "txn-1",
  state: "ISSUED",
  emailIdentityHmac: "hmac-of-email",
  generation: 1,
  issuedAt: NOW,
  expiresAt: NOW + SESSION_POLICY.emailOtpLifetimeSeconds,
  ...overrides,
})

describe("pre-auth transaction state machine", () => {
  it("walks the accepted happy path to CONSUMED", () => {
    const path = [
      ["ISSUED", "REQUEST_OTP", "OTP_REQUEST_STARTED"],
      ["OTP_REQUEST_STARTED", "OTP_REQUEST_SUCCEEDED", "OTP_REQUESTED"],
      ["OTP_REQUESTED", "VERIFY_OTP", "OTP_VERIFY_STARTED"],
      ["OTP_VERIFY_STARTED", "OTP_VERIFY_SUCCEEDED", "OTP_VERIFIED"],
      ["OTP_VERIFIED", "BOOTSTRAP_STARTED", "BOOTSTRAP_PENDING"],
      ["BOOTSTRAP_PENDING", "BOOTSTRAP_COMMITTED", "CONSUMED"],
    ] as const

    for (const [from, event, to] of path) {
      expect(nextPreAuthState(from, event)).toBe(to)
    }
  })

  it("records a lost send response as an unknown outcome", () => {
    const started = applyPreAuthEvent(transaction(), "REQUEST_OTP", NOW)

    expect(applyPreAuthEvent(started, "OTP_REQUEST_RESPONSE_LOST", NOW).state).toBe(
      "OUTCOME_UNKNOWN",
    )
  })

  it("never auto-retries a send whose outcome is unknown", () => {
    const unknown = transaction({ state: "OUTCOME_UNKNOWN" })

    // Only an explicit verify or an explicit cooldown-bound resend may move it.
    expect(nextPreAuthState("OUTCOME_UNKNOWN", "REQUEST_OTP")).toBeUndefined()
    expect(nextPreAuthState("OUTCOME_UNKNOWN", "OTP_REQUEST_SUCCEEDED")).toBeUndefined()
    expect(() => applyPreAuthEvent(unknown, "REQUEST_OTP", NOW)).toThrow(
      PreAuthTransitionError,
    )
  })

  it("makes a lost verify response terminal with no automatic retry", () => {
    const verifying = transaction({ state: "OTP_VERIFY_STARTED" })
    const lost = applyPreAuthEvent(verifying, "OTP_VERIFY_RESPONSE_LOST", NOW)

    expect(lost.state).toBe("VERIFY_OUTCOME_UNKNOWN")
    expect(isTerminal(lost.state)).toBe(true)
    for (const event of [
      "VERIFY_OTP",
      "OTP_VERIFY_SUCCEEDED",
      "BOOTSTRAP_STARTED",
    ] as const) {
      expect(() => applyPreAuthEvent(lost, event, NOW)).toThrow(PreAuthTransitionError)
    }
  })

  it("lets a transient bootstrap failure retry without repeating the OTP", () => {
    const pending = transaction({ state: "BOOTSTRAP_PENDING" })

    expect(applyPreAuthEvent(pending, "BOOTSTRAP_STARTED", NOW).state).toBe(
      "BOOTSTRAP_PENDING",
    )
    expect(applyPreAuthEvent(pending, "BOOTSTRAP_COMMITTED", NOW).state).toBe(
      "CONSUMED",
    )
    // Retrying must not walk back through OTP verification.
    expect(nextPreAuthState("BOOTSTRAP_PENDING", "VERIFY_OTP")).toBeUndefined()
  })

  it.each([
    "CONSUMED",
    "REVOKED",
    "EXPIRED",
    "FAILED",
    "VERIFY_OUTCOME_UNKNOWN",
  ] as const)("treats %s as terminal for every event", (state) => {
    expect(isTerminal(state)).toBe(true)
    for (const event of [
      "REQUEST_OTP",
      "VERIFY_OTP",
      "OTP_VERIFY_SUCCEEDED",
      "BOOTSTRAP_STARTED",
      "BOOTSTRAP_COMMITTED",
    ] as const) {
      expect(nextPreAuthState(state, event)).toBeUndefined()
    }
  })

  it("can revoke, expire or fail from every non-terminal state", () => {
    const nonTerminal = PRE_AUTH_STATES.filter(
      (state: PreAuthState) => !isTerminal(state),
    )

    expect(nonTerminal.length).toBeGreaterThan(0)
    for (const state of nonTerminal) {
      expect(nextPreAuthState(state, "REVOKE")).toBe("REVOKED")
      expect(nextPreAuthState(state, "EXPIRE")).toBe("EXPIRED")
      expect(nextPreAuthState(state, "FAIL")).toBe("FAILED")
    }
  })

  it("refuses any event but EXPIRE once the transaction has expired", () => {
    const stale = transaction({ expiresAt: NOW - 1 })

    expect(() => applyPreAuthEvent(stale, "REQUEST_OTP", NOW)).toThrow(
      PreAuthTransitionError,
    )
    expect(applyPreAuthEvent(stale, "EXPIRE", NOW).state).toBe("EXPIRED")
  })
})

describe("resend fences every earlier code", () => {
  it("refuses a resend inside the frozen 60 second cooldown", () => {
    const requested = transaction({ state: "OTP_REQUESTED" })

    expect(() =>
      resendPreAuthOtp(requested, {
        now: NOW + SESSION_POLICY.otpResendCooldownSeconds - 1,
        lastRequestedAt: NOW,
        cooldownSeconds: SESSION_POLICY.otpResendCooldownSeconds,
      }),
    ).toThrow(PreAuthTransitionError)
  })

  it("creates the next generation after the cooldown", () => {
    const requested = transaction({ state: "OTP_REQUESTED", generation: 1 })
    const resent = resendPreAuthOtp(requested, {
      now: NOW + SESSION_POLICY.otpResendCooldownSeconds,
      lastRequestedAt: NOW,
      cooldownSeconds: SESSION_POLICY.otpResendCooldownSeconds,
    })

    expect(resent.generation).toBe(2)
    expect(resent.state).toBe("OTP_REQUEST_STARTED")
  })

  it("refuses a resend once the transaction is terminal", () => {
    for (const state of ["CONSUMED", "REVOKED", "EXPIRED", "FAILED"] as const) {
      expect(() =>
        resendPreAuthOtp(transaction({ state }), {
          now: NOW + 3600,
          lastRequestedAt: NOW,
          cooldownSeconds: SESSION_POLICY.otpResendCooldownSeconds,
        }),
      ).toThrow(PreAuthTransitionError)
    }
  })
})

describe("delivery reconciliation is generation-fenced", () => {
  it("reconciles exactly the current unknown generation", () => {
    expect(
      canReconcileDelivery(transaction({ state: "OUTCOME_UNKNOWN", generation: 3 }), 3),
    ).toBe(true)
  })

  it("refuses to reconcile a superseded generation", () => {
    expect(
      canReconcileDelivery(transaction({ state: "OUTCOME_UNKNOWN", generation: 4 }), 3),
    ).toBe(false)
  })

  it("reconciles nothing from a state that is not an unknown send", () => {
    for (const state of ["OTP_REQUESTED", "CONSUMED", "REVOKED", "EXPIRED"] as const) {
      expect(canReconcileDelivery(transaction({ state, generation: 1 }), 1)).toBe(false)
    }
  })
})
