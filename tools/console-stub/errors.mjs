// The exact error contract the double may produce.
//
// EEM-9/07 found the double knew 32 of the 38 codes the Console can receive,
// so six refusals could never be exercised by any test: an invitation state
// conflict, an unoffered model profile, an unknown provider outcome, a rate
// limit, an oversized request and an unsupported server response. Status and
// retryability below are read from supabase/functions/console-api/errors.ts,
// which is the implementation that emits them.
//
// BACKFILL_NOT_APPROVABLE and NEW_MODEL_CALL_NOT_AUTHORIZED are deliberately
// absent. They belong to the operator contract, which shares error.json with
// this one, and no Console surface can receive them.

/** code -> [http status, retryable]. Retryability is the backend's to declare. */
export const ERRORS = {
  AUTHENTICATION_REQUIRED: [401, false],
  CAPABILITY_REQUIRED: [403, false],
  DEPENDENCY_UNAVAILABLE: [503, true],
  ENTITLEMENT_GENERATION_STALE: [409, false],
  GITHUB_SYNC_INCOMPLETE: [409, true],
  IDEMPOTENCY_KEY_REUSED: [409, false],
  INTERNAL_ERROR: [500, false],
  INVITATION_STATE_CONFLICT: [409, false],
  KNOWLEDGE_ACTION_NOT_ALLOWED: [409, false],
  LIFECYCLE_VERSION_CONFLICT: [409, false],
  MODEL_PROFILE_NOT_OFFERED: [409, false],
  ORGANIZATION_CONTROL_CONFLICT: [409, false],
  ORGANIZATION_LIMIT_NOT_PROVISIONED: [409, false],
  ORGANIZATION_MEMBERSHIP_REQUIRED: [403, false],
  PAID_OPERATION_NOT_AUTHORIZED: [403, false],
  PROVIDER_OUTCOME_UNKNOWN: [409, false],
  RATE_LIMITED: [429, true],
  REAUTHENTICATION_REQUIRED: [403, false],
  REPOSITORY_ACCESS_CHANGED: [409, false],
  REPOSITORY_IMPORT_ALREADY_ACTIVE: [409, false],
  REPOSITORY_IMPORT_FILTERS_INVALID: [422, false],
  REPOSITORY_IMPORT_JOB_NOT_RETRYABLE: [409, false],
  REPOSITORY_IMPORT_NOT_APPROVABLE: [409, false],
  REPOSITORY_IMPORT_NOT_CANCELLABLE: [409, false],
  REPOSITORY_IMPORT_NOT_FOUND: [404, false],
  REPOSITORY_IMPORT_NOT_PAUSABLE: [409, false],
  REPOSITORY_IMPORT_NOT_RESUMABLE: [409, false],
  REPOSITORY_LIMIT_REACHED: [409, false],
  REPOSITORY_NOT_ENTITLED: [409, false],
  REPOSITORY_REPLACEMENT_REQUIRES_OPERATOR: [409, false],
  REQUEST_INVALID: [400, false],
  REQUEST_TOO_LARGE: [413, false],
  RESOURCE_NOT_FOUND: [404, false],
  REVIEW_VERSION_CONFLICT: [409, false],
  SUPERSESSION_INVALID: [409, false],
  SUPERSESSION_TRAVERSAL_LIMIT: [409, false],
  UNSUPPORTED_SERVER_RESPONSE: [500, false],
  VERSION_CONFLICT: [409, false],
}

export const MESSAGES = {
  CAPABILITY_REQUIRED: "The required capability is unavailable.",
  INVITATION_STATE_CONFLICT: "The invitation state does not permit this action.",
  MODEL_PROFILE_NOT_OFFERED:
    "A named model profile is not offered to this organization.",
  PROVIDER_OUTCOME_UNKNOWN: "The provider outcome is unknown.",
  RATE_LIMITED: "The request rate limit was exceeded.",
  REQUEST_TOO_LARGE: "The request is too large.",
  RESOURCE_NOT_FOUND: "The requested resource is not available.",
  UNSUPPORTED_SERVER_RESPONSE: "The server response is unsupported by this client.",
  VERSION_CONFLICT: "The resource changed before this request was applied.",
}
