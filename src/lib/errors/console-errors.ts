import type { ConsoleError } from "@contracts/console"

/**
 * Map a published stable error code to a safe UI treatment.
 *
 * The backend publishes 40 stable codes and declares retryability itself. The
 * UI never derives retryability, and it never forwards a raw SQL, Supabase,
 * GitHub, worker or provider error. `error.message` is deliberately unused:
 * only the code decides what the customer sees.
 *
 * The customer-facing wording is open decision 2 and belongs to the product
 * owner. The strings below state only what the treatment already implies; they
 * are not approved product copy, and
 * `docs/architecture/console-ui-conventions.md` carries the open decision.
 */

export type ConsoleErrorCode = ConsoleError["error"]["code"]

export const ERROR_TREATMENTS = [
  "sign-in-required",
  "reauthentication-required",
  "switch-organization",
  "not-permitted",
  "reload-and-resubmit",
  "state-final",
  "waiting-on-evirion",
  "unknown-outcome",
  "retry-bounded",
  "field-level",
  "non-retryable",
] as const

export type ErrorTreatment = (typeof ERROR_TREATMENTS)[number]

/**
 * A mapped failure in the shape a page or component renders.
 *
 * It lives beside the mapping rather than beside the query that produces it,
 * so a component can name the type without depending on a server-only module
 * even for a type that compiles away.
 */
export type ViewFailure = {
  readonly code: ConsoleErrorCode | "UNSUPPORTED_SERVER_RESPONSE"
  readonly treatment: ErrorTreatment
  readonly message: string
  /** Declared by the backend projection, never derived from the code. */
  readonly retryable: boolean
  /** Shown so a customer can quote it to support instead of retrying. */
  readonly requestId?: string
  readonly currentVersion?: number
  /** Present on a sequence-token conflict so the UI can reload exactly. */
  readonly currentSequence?: number
}

export type MappedError = {
  readonly code: ConsoleErrorCode | "UNSUPPORTED_SERVER_RESPONSE"
  readonly treatment: ErrorTreatment
  /** Copied from the backend projection, never inferred from the code. */
  readonly retryable: boolean
  readonly requestId?: string
  /** Present on an optimistic-version conflict so the UI can reload exactly. */
  readonly currentVersion?: number
  /** Present on a sequence-token conflict so the UI can reload exactly. */
  readonly currentSequence?: number
}

/**
 * Exhaustive over the published code union. Adding a code to the contract
 * without a reviewed treatment fails the build rather than defaulting to a
 * guess about whether the action is safe to retry.
 */
const TREATMENTS: Readonly<Record<ConsoleErrorCode, ErrorTreatment>> = {
  AUTHENTICATION_REQUIRED: "sign-in-required",
  // The customer is signed in; this action needs a fresher proof than the
  // current session carries. It is not sign-in-required and not not-permitted.
  REAUTHENTICATION_REQUIRED: "reauthentication-required",
  ORGANIZATION_MEMBERSHIP_REQUIRED: "switch-organization",
  CAPABILITY_REQUIRED: "not-permitted",
  RESOURCE_NOT_FOUND: "not-permitted",

  VERSION_CONFLICT: "reload-and-resubmit",
  REVIEW_VERSION_CONFLICT: "reload-and-resubmit",
  LIFECYCLE_VERSION_CONFLICT: "reload-and-resubmit",
  ENTITLEMENT_GENERATION_STALE: "reload-and-resubmit",
  REPOSITORY_ACCESS_CHANGED: "reload-and-resubmit",
  INVITATION_STATE_CONFLICT: "reload-and-resubmit",
  ORGANIZATION_CONTROL_CONFLICT: "reload-and-resubmit",

  REPOSITORY_NOT_ENTITLED: "state-final",
  REPOSITORY_LIMIT_REACHED: "state-final",
  REPOSITORY_REPLACEMENT_REQUIRES_OPERATOR: "state-final",
  ORGANIZATION_LIMIT_NOT_PROVISIONED: "state-final",
  BACKFILL_NOT_APPROVABLE: "state-final",
  KNOWLEDGE_ACTION_NOT_ALLOWED: "state-final",
  SUPERSESSION_INVALID: "state-final",
  SUPERSESSION_TRAVERSAL_LIMIT: "state-final",
  GITHUB_SYNC_INCOMPLETE: "state-final",
  REPOSITORY_IMPORT_JOB_NOT_RETRYABLE: "state-final",
  REPOSITORY_IMPORT_NOT_CANCELLABLE: "state-final",
  REPOSITORY_IMPORT_NOT_RESUMABLE: "state-final",
  REPOSITORY_IMPORT_NOT_PAUSABLE: "state-final",
  REPOSITORY_IMPORT_NOT_APPROVABLE: "state-final",
  REPOSITORY_IMPORT_ALREADY_ACTIVE: "state-final",
  IDEMPOTENCY_KEY_REUSED: "state-final",
  REPOSITORY_IMPORT_NOT_FOUND: "not-permitted",
  REPOSITORY_IMPORT_FILTERS_INVALID: "field-level",
  // Field level rather than state final: the action is available, the named
  // value is not, and the customer fixes it by naming a profile the
  // organization is offered.
  MODEL_PROFILE_NOT_OFFERED: "field-level",

  NEW_MODEL_CALL_NOT_AUTHORIZED: "waiting-on-evirion",
  PAID_OPERATION_NOT_AUTHORIZED: "waiting-on-evirion",

  PROVIDER_OUTCOME_UNKNOWN: "unknown-outcome",
  UNSUPPORTED_SERVER_RESPONSE: "unknown-outcome",

  RATE_LIMITED: "retry-bounded",
  DEPENDENCY_UNAVAILABLE: "retry-bounded",
  REQUEST_INVALID: "field-level",
  REQUEST_TOO_LARGE: "field-level",
  INTERNAL_ERROR: "non-retryable",
}

/**
 * The treatment for a code that arrived without its payload.
 *
 * A mutation answers with a redirect, so the page that reports the outcome
 * sees the stable code but not the response that carried it. Only the reviewed
 * code-to-treatment table is consulted here; `retryable` is deliberately not
 * reconstructed, because it belongs to the backend payload and a boolean
 * re-derived on a later request would be the UI asserting it for itself.
 */
export const treatmentForCode = (code: string): ErrorTreatment | undefined =>
  Object.hasOwn(TREATMENTS, code) ? TREATMENTS[code as ConsoleErrorCode] : undefined

/** Anything the contract did not publish fails closed here. */
export const UNKNOWN_ERROR: MappedError = {
  code: "UNSUPPORTED_SERVER_RESPONSE",
  treatment: "unknown-outcome",
  retryable: false,
}

export const mapConsoleError = (payload: ConsoleError): MappedError => {
  const treatment = TREATMENTS[payload.error.code]
  if (treatment === undefined) return UNKNOWN_ERROR

  return {
    code: payload.error.code,
    treatment,
    // The backend owns retryability. A treatment never overrides it.
    retryable: payload.error.retryable,
    requestId: payload.requestId,
    ...(payload.error.currentVersion === undefined
      ? {}
      : { currentVersion: payload.error.currentVersion }),
    ...(payload.error.currentSequence === undefined
      ? {}
      : { currentSequence: payload.error.currentSequence }),
  }
}

/**
 * Neutral text derived from the treatment. Approved customer copy is open
 * decision 2; nothing here describes a backend internal.
 */
export const describeTreatment = (treatment: ErrorTreatment): string => {
  switch (treatment) {
    case "sign-in-required":
      return "Sign in to continue."
    case "reauthentication-required":
      return "Confirm your identity to continue."
    case "switch-organization":
      return "This is not available for the selected organization."
    case "not-permitted":
      return "This is not available for your account."
    case "reload-and-resubmit":
      return "This changed while you were working. Reload and try again."
    case "state-final":
      return "This action is not available in the current state."
    case "waiting-on-evirion":
      return "Evirion authorization is pending. There is nothing to do here."
    case "unknown-outcome":
      return "The outcome is not known yet. Refresh to check again."
    case "retry-bounded":
      return "The service is busy. Try again shortly."
    case "field-level":
      return "Check the highlighted fields and try again."
    case "non-retryable":
      return "Something went wrong and nothing was changed."
    default: {
      const exhaustive: never = treatment
      throw new Error(`unhandled error treatment: ${String(exhaustive)}`)
    }
  }
}
