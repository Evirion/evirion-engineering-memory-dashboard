import type { SignOutScope } from "./auth-provider"

/**
 * How an application-session revocation maps onto a provider sign-out.
 *
 * Application denial always commits first. The provider effect is a durable
 * reconciled follow-up, because a provider access token can stay valid until
 * `exp` and must never be able to restore authorization on its own.
 */

export const REVOCATION_SELECTIONS = ["current", "others", "all", "selected"] as const

export type RevocationSelection = (typeof REVOCATION_SELECTIONS)[number]

export type ProviderEffect =
  | { readonly kind: "scope"; readonly scope: SignOutScope }
  /**
   * The standard provider API cannot revoke one arbitrary session by ID, so a
   * selected non-current revocation is application-only. Its provider effect
   * terminates as NOT_APPLICABLE and is never retried forever.
   */
  | { readonly kind: "not-applicable" }

export const providerEffectFor = (selection: RevocationSelection): ProviderEffect => {
  switch (selection) {
    case "current":
      return { kind: "scope", scope: "local" }
    case "others":
      return { kind: "scope", scope: "others" }
    case "all":
      return { kind: "scope", scope: "global" }
    case "selected":
      return { kind: "not-applicable" }
    default: {
      const exhaustive: never = selection
      throw new Error(`unhandled revocation selection: ${String(exhaustive)}`)
    }
  }
}

export const PROVIDER_EFFECT_STATES = [
  "PENDING",
  "STARTED",
  "SUCCEEDED",
  "FAILED_RETRYABLE",
  "FAILED_FINAL",
  "OUTCOME_UNKNOWN",
  "NOT_APPLICABLE",
] as const

export type ProviderEffectState = (typeof PROVIDER_EFFECT_STATES)[number]

/**
 * A lost sign-out response is unknown, not failed. Reconciliation must observe
 * provider state before any bounded retry; without a safe observation contract
 * it escalates as a manual incident and never restores access.
 */
export const isTerminalProviderEffect = (state: ProviderEffectState): boolean =>
  state === "SUCCEEDED" || state === "FAILED_FINAL" || state === "NOT_APPLICABLE"

export const mayRetryProviderEffect = (state: ProviderEffectState): boolean =>
  state === "FAILED_RETRYABLE"

export const requiresObservationBeforeRetry = (state: ProviderEffectState): boolean =>
  state === "OUTCOME_UNKNOWN"
