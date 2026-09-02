import { describe, expect, it } from "vitest"

import {
  PROVIDER_EFFECT_STATES,
  REVOCATION_SELECTIONS,
  type ProviderEffectState,
  isTerminalProviderEffect,
  mayRetryProviderEffect,
  providerEffectFor,
  requiresObservationBeforeRetry,
} from "@/lib/auth/session-revocation"

describe("application revocation maps onto a provider scope", () => {
  it("uses the fixed mapping", () => {
    expect(providerEffectFor("current")).toEqual({ kind: "scope", scope: "local" })
    expect(providerEffectFor("others")).toEqual({ kind: "scope", scope: "others" })
    expect(providerEffectFor("all")).toEqual({ kind: "scope", scope: "global" })
  })

  it("records a selected non-current session as not applicable", () => {
    // The standard provider API cannot revoke one arbitrary session by ID, so
    // the effect terminates rather than retrying forever.
    expect(providerEffectFor("selected")).toEqual({ kind: "not-applicable" })
    expect(isTerminalProviderEffect("NOT_APPLICABLE")).toBe(true)
    expect(mayRetryProviderEffect("NOT_APPLICABLE")).toBe(false)
  })

  it("covers every selection the contract defines", () => {
    expect([...REVOCATION_SELECTIONS]).toEqual(["current", "others", "all", "selected"])
    for (const selection of REVOCATION_SELECTIONS) {
      expect(() => providerEffectFor(selection)).not.toThrow()
    }
  })
})

describe("provider sign-out effect lifecycle", () => {
  it("treats success, final failure and not-applicable as terminal", () => {
    for (const state of ["SUCCEEDED", "FAILED_FINAL", "NOT_APPLICABLE"] as const) {
      expect(isTerminalProviderEffect(state)).toBe(true)
      expect(mayRetryProviderEffect(state)).toBe(false)
    }
  })

  it("retries only a definite retryable failure", () => {
    expect(mayRetryProviderEffect("FAILED_RETRYABLE")).toBe(true)
    for (const state of ["PENDING", "STARTED", "OUTCOME_UNKNOWN"] as const) {
      expect(mayRetryProviderEffect(state)).toBe(false)
    }
  })

  it("requires observation before retrying an unknown outcome", () => {
    // A lost sign-out response is unknown, not failed. The effect may already
    // have happened, so a blind retry is forbidden.
    expect(requiresObservationBeforeRetry("OUTCOME_UNKNOWN")).toBe(true)
    expect(isTerminalProviderEffect("OUTCOME_UNKNOWN")).toBe(false)
    expect(mayRetryProviderEffect("OUTCOME_UNKNOWN")).toBe(false)

    for (const state of PROVIDER_EFFECT_STATES.filter(
      (candidate: ProviderEffectState) => candidate !== "OUTCOME_UNKNOWN",
    )) {
      expect(requiresObservationBeforeRetry(state)).toBe(false)
    }
  })

  it("leaves no state both terminal and retryable", () => {
    for (const state of PROVIDER_EFFECT_STATES) {
      expect(isTerminalProviderEffect(state) && mayRetryProviderEffect(state)).toBe(
        false,
      )
    }
  })
})
