import type {
  KnowledgeCorrections,
  KnowledgeDetail,
  KnowledgeLifecycleState,
  KnowledgeReview,
  KnowledgeReviewState,
  KnowledgeSummary,
} from "@contracts/console"

/**
 * How one Knowledge Object reads on screen.
 *
 * Nothing here decides anything. The review decision, the lifecycle state,
 * both optimistic tokens, `humanEdited` and the two allowed-action lists all
 * arrive from the backend and are only rendered or narrowed. In particular:
 *
 * - `humanEdited` is read, never inferred by comparing payloads;
 * - `PENDING` is review sequence zero, which the backend derives from the
 *   absence of a review. An object with no review is pending, not unknown;
 * - review and lifecycle are two axes. An object can be reviewed and
 *   unresolved, or active and later re-reviewed, so they never collapse into
 *   one status.
 *
 * The wording below is neutral text derived from the contract's own
 * vocabulary. It is not approved product copy: open decisions 2 and 3 own the
 * customer-facing wording and are recorded in
 * `docs/architecture/console-ui-conventions.md`.
 */

/** Recording a review decision. The contract names it on the reviews operation. */
export const KNOWLEDGE_REVIEW_CAPABILITY = "knowledge.review"

/** Activating, superseding and requesting a correction. A viewer does not hold it. */
export const KNOWLEDGE_LIFECYCLE_CAPABILITY = "knowledge.lifecycle.manage"

export type ReviewDecision = KnowledgeReviewState["decision"]
export type LifecycleState = KnowledgeLifecycleState["lifecycleState"]
export type ReviewAction = KnowledgeReviewState["allowedActions"][number]
export type LifecycleAction = KnowledgeLifecycleState["allowedLifecycleActions"][number]
type CorrectionRequest = KnowledgeCorrections["correctionRequests"][number]
export type CorrectionStatus = CorrectionRequest["status"]
export type AdmissionDisposition =
  KnowledgeDetail["technicalDetails"]["admissionDisposition"]

/**
 * The two admission outcomes that are legitimate machine decisions and are
 * never Knowledge Objects.
 *
 * `REJECTED` and `QUARANTINED` are not infrastructure failures and not errors.
 * They simply produced no knowledge, so no surface may present one as trusted.
 */
export const isAdmittedKnowledge = (disposition: AdmissionDisposition): boolean =>
  disposition === "ACCEPTED"

/** Neutral text for a review decision. `PENDING` is derived, not stored. */
export const reviewDecisionLabel = (decision: ReviewDecision): string => {
  switch (decision) {
    case "PENDING":
      return "Awaiting review"
    case "APPROVED":
      return "Approved"
    case "EDITED":
      return "Edited by a reviewer"
    case "USER_REJECTED":
      return "Rejected by a reviewer"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported review state"
    default: {
      const exhaustive: never = decision
      throw new Error(`unhandled review decision: ${String(exhaustive)}`)
    }
  }
}

/** Neutral text for a lifecycle state. Independent of the review decision. */
export const lifecycleStateLabel = (state: LifecycleState): string => {
  switch (state) {
    case "UNRESOLVED":
      return "Unresolved"
    case "ACTIVE":
      return "Active"
    case "SUPERSEDED":
      return "Superseded"
    case "WITHDRAWN":
      return "Withdrawn"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported lifecycle state"
    default: {
      const exhaustive: never = state
      throw new Error(`unhandled lifecycle state: ${String(exhaustive)}`)
    }
  }
}

/**
 * Neutral text for a correction request.
 *
 * A failed request is a bounded support status. It never exposes which
 * operator acted, what they decided internally, or why the execution failed
 * beyond the published code.
 */
export const correctionStatusLabel = (status: CorrectionStatus): string => {
  switch (status) {
    case "REQUESTED":
      return "Requested"
    case "EXECUTING":
      return "Evirion is applying this"
    case "EXECUTED":
      return "Applied"
    case "FAILED":
      return "Needs Evirion support"
    case "REJECTED":
      return "Declined by Evirion"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported request state"
    default: {
      const exhaustive: never = status
      throw new Error(`unhandled correction status: ${String(exhaustive)}`)
    }
  }
}

export type KnowledgeControls = {
  readonly canApprove: boolean
  readonly canEdit: boolean
  readonly canReject: boolean
  readonly canRevertToOriginal: boolean
  readonly canMarkActive: boolean
  readonly canSupersede: boolean
  readonly canRequestCorrection: boolean
}

const NO_CONTROLS: KnowledgeControls = {
  canApprove: false,
  canEdit: false,
  canReject: false,
  canRevertToOriginal: false,
  canMarkActive: false,
  canSupersede: false,
  canRequestCorrection: false,
}

/**
 * Which controls to render.
 *
 * The contract is explicit that `allowedActions` is the authority for what the
 * interface may offer and that a client never infers it, so both lists come
 * from the backend and are only narrowed here by the session capability. They
 * are never widened, and no state is read to decide that an action ought to be
 * available.
 *
 * Hiding a control is a convenience rather than a control. The backend refuses
 * the request either way, and every refusal path is rendered even for an
 * action that is also hidden.
 */
export const knowledgeControls = (
  review: KnowledgeReviewState | undefined,
  lifecycle: KnowledgeLifecycleState | undefined,
  capabilities: readonly string[],
): KnowledgeControls => {
  const mayReview = capabilities.includes(KNOWLEDGE_REVIEW_CAPABILITY)
  const mayManage = capabilities.includes(KNOWLEDGE_LIFECYCLE_CAPABILITY)
  const allowed = review?.allowedActions ?? []
  const lifecycleAllowed = lifecycle?.allowedLifecycleActions ?? []

  return {
    ...NO_CONTROLS,
    canApprove: mayReview && allowed.includes("APPROVE"),
    canEdit: mayReview && allowed.includes("EDIT"),
    canReject: mayReview && allowed.includes("USER_REJECT"),
    canRevertToOriginal:
      mayReview && allowed.includes("REVERT_TO_ORIGINAL_AND_APPROVE"),
    canMarkActive: mayManage && lifecycleAllowed.includes("MARK_ACTIVE"),
    canSupersede: mayManage && lifecycleAllowed.includes("MARK_SUPERSEDED"),
    canRequestCorrection: mayManage && lifecycleAllowed.includes("REQUEST_CORRECTION"),
  }
}

/**
 * The edited derivative, when one exists.
 *
 * `humanEdited` is the backend's own fact, taken from the effective review
 * being `EDITED`. The payload is read from that review rather than compared
 * against the original, because comparing two payloads would make the UI the
 * authority on whether a human edited anything.
 */
export type EditedDerivative = {
  readonly payload: Record<string, unknown>
  readonly reviewSequence: number
  readonly recordedAt: string
  readonly schemaVersion?: string
}

/**
 * Three outcomes, not two.
 *
 * `unavailable` is the one worth naming. `review` is optional in the contract,
 * `latestReview` is nullable and `editedPayload` is optional, so the backend
 * can legitimately say an object is edited and give nothing to render. Folding
 * that into "no edit" would leave the page declaring the object edited while
 * showing only the machine extraction, with no explanation for the gap, and
 * would quietly hand the edit form the original to start a second edit from.
 */
export type DerivativeState =
  | { readonly status: "none" }
  | { readonly status: "unavailable" }
  | { readonly status: "ready"; readonly derivative: EditedDerivative }

export const editedDerivativeOf = (detail: KnowledgeDetail): DerivativeState => {
  if (!detail.humanEdited) return { status: "none" }

  const latest = detail.review?.latestReview
  if (!latest || latest.editedPayload === undefined) return { status: "unavailable" }

  return {
    status: "ready",
    derivative: {
      payload: latest.editedPayload,
      reviewSequence: latest.reviewSequence,
      recordedAt: latest.recordedAt,
      ...(latest.editSchemaVersion === undefined
        ? {}
        : { schemaVersion: latest.editSchemaVersion }),
    },
  }
}

/** Neutral text for one recorded review action. */
export const reviewActionLabel = (action: KnowledgeReview["action"]): string => {
  switch (action) {
    case "APPROVE":
      return "Approved the original"
    case "EDIT":
      return "Recorded an edited derivative"
    case "USER_REJECT":
      return "Rejected"
    case "REVERT_TO_ORIGINAL_AND_APPROVE":
      return "Reverted to the original and approved"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported review action"
    default: {
      const exhaustive: never = action
      throw new Error(`unhandled review action: ${String(exhaustive)}`)
    }
  }
}

/** The row summary as the queue renders it, with both axes kept separate. */
export type QueueRow = {
  readonly knowledgeObjectId: string
  readonly shortClaim: string
  readonly knowledgeType: string
  readonly pullRequestNumber: number | null
  readonly pullRequestTitle: string | null
  readonly mergedAt: string | null
  readonly confidence: number
  readonly reviewLabel: string
  readonly lifecycleLabel: string
}

export const queueRow = (summary: KnowledgeSummary): QueueRow => ({
  knowledgeObjectId: summary.knowledgeObjectId,
  shortClaim: summary.shortClaim,
  knowledgeType: summary.knowledgeType,
  pullRequestNumber: summary.pullRequestNumber,
  pullRequestTitle: summary.pullRequestTitle,
  mergedAt: summary.mergedAt,
  confidence: summary.confidence,
  reviewLabel: reviewDecisionLabel(summary.reviewStatus),
  lifecycleLabel: lifecycleStateLabel(summary.lifecycleState),
})
