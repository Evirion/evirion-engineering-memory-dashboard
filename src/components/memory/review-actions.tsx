import type { KnowledgeDetail } from "@contracts/console"

import {
  type KnowledgeControls,
  editedDerivativeOf,
} from "@/lib/knowledge/presentation"

/**
 * The four review decisions.
 *
 * Every form posts to a same-origin BFF route and carries the session-bound
 * CSRF proof, the identifier, one minted idempotency key, and both optimistic
 * tokens exactly as the backend reported them. Nothing here synthesises,
 * defaults or increments a token.
 *
 * A control appears only where the backend's own `allowedActions` permits it
 * and the session capability agrees. Hiding one is a convenience: the backend
 * refuses either way, and the refusal path is rendered regardless.
 *
 * Reverting is its own action. `REV-005` gives an edited object no generic
 * approve, because that would silently discard the edit; the explicit revert
 * records the original hash and leaves the edit in the history.
 */

const card = "flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"
const field = "flex flex-col gap-1"
const labelClass = "text-xs font-medium tracking-wide text-slate-500 uppercase"
const control =
  "rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
const button =
  "self-start rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"

const REJECT_REASONS = [
  ["INCORRECT", "The claim is incorrect"],
  ["NOT_DURABLE", "It is not durable knowledge"],
  ["UNSUPPORTED", "The evidence does not support it"],
  ["TOO_VAGUE", "It is too vague to act on"],
  ["DUPLICATE", "It duplicates knowledge we already have"],
  ["OUTDATED", "It is outdated"],
  ["OTHER", "Another reason, described below"],
] as const

const SEVERITIES = [
  ["NONE", "None"],
  ["MINOR", "Minor"],
  ["MAJOR", "Major"],
  ["CRITICAL", "Critical"],
] as const

/**
 * Eleven of the thirteen editable keys. The two enums are rendered as selects
 * below, because a free-text box cannot express a closed vocabulary.
 *
 * A `list` field has no lower bound in the schema, so it is not required: a
 * claim that documents no trade-off is edited exactly like one that documents
 * three. The four `text` fields carry a minimum length and are required.
 */
const EDIT_FIELDS = [
  ["problem", "Problem", "text"],
  ["knowledge", "Knowledge", "text"],
  ["designRationale", "Design rationale", "text"],
  ["futureImpact", "Future impact", "text"],
  ["documentedTradeoffs", "Documented trade-offs", "list"],
  ["explicitAlternatives", "Explicit alternatives", "list"],
  ["constraints", "Constraints", "list"],
  ["invariants", "Invariants", "list"],
  ["failureModes", "Failure modes", "list"],
  ["affectedSystems", "Affected systems", "list"],
  ["answerableQuestions", "Answerable questions", "list"],
] as const

/** The closed vocabulary `REV-002` publishes for the classification. */
const KNOWLEDGE_TYPES = [
  "ArchitectureDecision",
  "APIBehavior",
  "FeatureBehavior",
  "Constraint",
  "Invariant",
  "FailureMode",
  "Tradeoff",
  "MigrationPattern",
  "LifecycleBehavior",
  "ConcurrencyBehavior",
  "OperationalBehavior",
  "CompatibilityRule",
  "PerformanceBehavior",
  "SecurityBehavior",
  "SystemBehavior",
  "TechnologyChoice",
  "InfrastructureDecision",
  "ProcessDecision",
  "TeamOwnership",
  "ExternalDependency",
  "ProductDecision",
  "ImplementedTechnicalDetail",
] as const

const IMPLEMENTATION_STATUSES = [
  "implemented",
  "proposed",
  "partially_implemented",
  "unknown",
] as const

export type ReviewFormProps = {
  readonly detail: KnowledgeDetail
  readonly controls: KnowledgeControls
  readonly csrfToken: string
  readonly idempotencyKeys: Readonly<Record<string, string>>
}

const asText = (value: unknown): string => (typeof value === "string" ? value : "")

const asLines = (value: unknown): string =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").join("\n")
    : ""

/**
 * The hidden fields every knowledge mutation carries.
 *
 * Both tokens come from the projection this page rendered. They travel as
 * strings so zero survives: review sequence zero is `PENDING` and lifecycle
 * version zero is `UNRESOLVED`, and a falsy check on either would turn a first
 * review into a stale request.
 */
const Hidden = ({
  detail,
  csrfToken,
  idempotencyKey,
}: {
  detail: KnowledgeDetail
  csrfToken: string
  idempotencyKey: string
}) => (
  <>
    <input type="hidden" name="csrfToken" value={csrfToken} />
    <input type="hidden" name="knowledgeObjectId" value={detail.knowledgeObjectId} />
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <input
      type="hidden"
      name="expectedReviewSequence"
      value={String(detail.lifecycle.reviewSequence)}
    />
    <input
      type="hidden"
      name="expectedLifecycleVersion"
      value={String(detail.lifecycle.lifecycleVersion)}
    />
  </>
)

export const ApproveOriginalForm = ({
  detail,
  controls,
  csrfToken,
  idempotencyKeys,
}: ReviewFormProps) =>
  controls.canApprove ? (
    <form
      action="/api/memory/reviews"
      method="post"
      data-testid="review-approve"
      className={card}
    >
      <Hidden
        detail={detail}
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKeys["approve"] ?? ""}
      />
      <input type="hidden" name="action" value="APPROVE" />
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">
          Approve the machine extraction
        </h3>
        <p className="text-xs text-slate-600">
          Records that the original claim is correct as extracted. It does not activate
          the object.
        </p>
      </div>
      <button type="submit" className={button}>
        Approve the original
      </button>
    </form>
  ) : null

export const RevertToOriginalForm = ({
  detail,
  controls,
  csrfToken,
  idempotencyKeys,
}: ReviewFormProps) =>
  controls.canRevertToOriginal ? (
    <form
      action="/api/memory/reviews"
      method="post"
      data-testid="review-revert"
      className={card}
    >
      <Hidden
        detail={detail}
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKeys["revert"] ?? ""}
      />
      <input type="hidden" name="action" value="REVERT_TO_ORIGINAL_AND_APPROVE" />
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">
          Revert to the original and approve
        </h3>
        <p className="text-xs text-slate-600">
          {/* Explicit, and never a silent discard: the edit stays in the
              history and this appends a new decision beside it. */}
          Records a new decision approving the machine extraction. The earlier edit is
          kept in the history and is not deleted.
        </p>
      </div>
      <button type="submit" className={button}>
        Revert to the original and approve
      </button>
    </form>
  ) : null

export const RejectForm = ({
  detail,
  controls,
  csrfToken,
  idempotencyKeys,
}: ReviewFormProps) =>
  controls.canReject ? (
    <form
      action="/api/memory/reviews"
      method="post"
      data-testid="review-reject"
      className={card}
    >
      <Hidden
        detail={detail}
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKeys["reject"] ?? ""}
      />
      <input type="hidden" name="action" value="USER_REJECT" />
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">Reject this claim</h3>
        <p className="text-xs text-slate-600">
          The original extraction and its evidence are kept. The object leaves the
          reviewed-active projection and stays in the history.
        </p>
      </div>
      <div className={field}>
        <label htmlFor="rejectReasonCode" className={labelClass}>
          Reason
        </label>
        <select
          id="rejectReasonCode"
          name="rejectReasonCode"
          required
          defaultValue=""
          className={control}
        >
          <option value="" disabled>
            Choose a reason
          </option>
          {REJECT_REASONS.map(([code, text]) => (
            <option key={code} value={code}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor="rejectIssueSeverity" className={labelClass}>
          Issue severity
        </label>
        <select
          id="rejectIssueSeverity"
          name="issueSeverity"
          required
          defaultValue="MINOR"
          className={control}
        >
          {SEVERITIES.map(([code, text]) => (
            <option key={code} value={code}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor="rejectNote" className={labelClass}>
          Note
        </label>
        <textarea
          id="rejectNote"
          name="note"
          rows={2}
          maxLength={2000}
          className={control}
        />
        <p className="text-xs text-slate-600">
          {/* `OTHER` carries no meaning on its own, so the backend requires a
              note beside it. */}
          Required when the reason is &quot;Another reason&quot;.
        </p>
      </div>
      <button type="submit" className={button}>
        Reject
      </button>
    </form>
  ) : null

export const EditForm = ({
  detail,
  controls,
  csrfToken,
  idempotencyKeys,
}: ReviewFormProps) => {
  if (!controls.canEdit) return null

  // Prefilled from the effective payload: the current derivative when a
  // reviewer already recorded one, and the machine extraction otherwise.
  // Starting a second edit from the original would silently discard the words
  // the previous reviewer chose. `REV-002` defines an edit as a full reviewed
  // derivative rather than a patch, so every field is submitted either way.
  const derivative = editedDerivativeOf(detail)
  const payload =
    derivative.status === "ready"
      ? derivative.derivative.payload
      : detail.originalPayload

  return (
    <form
      action="/api/memory/reviews"
      method="post"
      data-testid="review-edit"
      className={card}
    >
      <Hidden
        detail={detail}
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKeys["edit"] ?? ""}
      />
      <input type="hidden" name="action" value="EDIT" />
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">
          Record an edited derivative
        </h3>
        <p className="text-xs text-slate-600">
          The machine extraction is kept and stays on this page. Your words are recorded
          beside it as a reviewer's derivative.
        </p>
        <p className="text-xs font-medium text-amber-900">
          The evidence is not re-extracted. It continues to support the machine
          extraction, not your edit.
        </p>
        {derivative.status === "unavailable" ? (
          // The alternative to saying this is starting a second edit from the
          // machine extraction without mentioning that an earlier one exists,
          // which is the silent discard this warning exists to prevent.
          <p
            data-testid="review-edit-derivative-unavailable"
            className="text-xs font-medium text-amber-900"
          >
            An earlier reviewer already edited this claim and their wording is not
            available right now. These fields start from the machine extraction, so
            recording an edit now will not carry their words forward. Refresh before
            editing if you need them.
          </p>
        ) : null}
      </div>
      <div className={field}>
        <label htmlFor="edit-knowledgeType" className={labelClass}>
          Knowledge type
        </label>
        <select
          id="edit-knowledgeType"
          name="knowledgeType"
          required
          defaultValue={asText(payload["knowledgeType"]) || detail.knowledgeType}
          className={control}
        >
          {KNOWLEDGE_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor="edit-implementationStatus" className={labelClass}>
          Implementation status
        </label>
        <select
          id="edit-implementationStatus"
          name="implementationStatus"
          required
          defaultValue={
            asText(payload["implementationStatus"]) || detail.implementationStatus
          }
          className={control}
        >
          {IMPLEMENTATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      {EDIT_FIELDS.map(([key, text, kind]) => (
        <div key={key} className={field}>
          <label htmlFor={`edit-${key}`} className={labelClass}>
            {text}
          </label>
          <textarea
            id={`edit-${key}`}
            name={key}
            rows={kind === "list" ? 2 : 3}
            required={kind === "text"}
            defaultValue={
              kind === "list" ? asLines(payload[key]) : asText(payload[key])
            }
            className={control}
          />
          {kind === "list" ? (
            <p className="text-xs text-slate-600">
              One entry per line. Leave empty if there are none.
            </p>
          ) : null}
        </div>
      ))}
      <div className={field}>
        <label htmlFor="editIssueSeverity" className={labelClass}>
          Issue severity
        </label>
        <select
          id="editIssueSeverity"
          name="issueSeverity"
          required
          defaultValue="MINOR"
          className={control}
        >
          {SEVERITIES.map(([code, text]) => (
            <option key={code} value={code}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor="editNote" className={labelClass}>
          Note
        </label>
        <textarea
          id="editNote"
          name="note"
          rows={2}
          maxLength={2000}
          className={control}
        />
      </div>
      <button type="submit" className={button}>
        Record the edit
      </button>
    </form>
  )
}

export const ReviewActions = (props: ReviewFormProps) => {
  const { controls, detail } = props
  const anything =
    controls.canApprove ||
    controls.canEdit ||
    controls.canReject ||
    controls.canRevertToOriginal

  // `review` is optional in the contract, and it is the only source of
  // `allowedActions`. Its absence and a state that permits nothing produce the
  // same empty set, so they are told apart here rather than both being
  // reported as the object's current state.
  const undetermined = detail.review === undefined

  return (
    <section
      aria-label="Review decisions"
      data-testid="review-actions"
      className="flex flex-col gap-3"
    >
      <h2 className="text-sm font-semibold text-slate-900">Review decisions</h2>
      {anything ? null : (
        <p
          data-testid={
            undetermined ? "review-actions-undetermined" : "review-actions-none"
          }
          className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          {undetermined
            ? "Which review decisions are available could not be determined right now. Refresh to check again."
            : "No review decision is available to you for this Knowledge Object in its current state."}
        </p>
      )}
      <ApproveOriginalForm {...props} />
      <RevertToOriginalForm {...props} />
      <EditForm {...props} />
      <RejectForm {...props} />
    </section>
  )
}
