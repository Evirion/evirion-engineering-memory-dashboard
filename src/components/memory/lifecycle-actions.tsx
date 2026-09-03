import type { KnowledgeDetail } from "@contracts/console"

import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import type { KnowledgeControls } from "@/lib/knowledge/presentation"
import type { SupersessionContext } from "@/server/queries/knowledge"

/**
 * Activation, supersession and the correction request.
 *
 * Lifecycle is the second axis. None of these forms records a review, and the
 * copy says so, because an object can be reviewed and unresolved or active and
 * later re-reviewed.
 *
 * Supersession takes two steps on purpose. `J-006` requires the Console to
 * display the relation direction and a confirmation, and the mutation carries
 * both objects' pairs; selecting the replacement first is what lets the
 * reviewer observe all four tokens before submitting rather than have the
 * Console fetch two of them behind their back.
 *
 * Three of these operations carry a published precondition the Console cannot
 * evaluate: the contract requires recent reauthentication for activation,
 * supersession and correction, and no field of the live session projection
 * says whether that is currently satisfied. The confirm step states the
 * precondition rather than claiming to know it is met.
 */

const card = "flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"
const field = "flex flex-col gap-1"
const labelClass = "text-xs font-medium tracking-wide text-slate-500 uppercase"
const control =
  "rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
const button =
  "self-start rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"

const CORRECTION_TYPES = [
  ["RETRACT_SUPERSESSION", "Undo a supersession that was recorded in error"],
  ["WITHDRAW_ACTIVE_KNOWLEDGE", "Withdraw this from trusted memory"],
  ["RESTORE_UNRESOLVED", "Return this to unresolved"],
] as const

const CORRECTION_REASONS = [
  ["SUPERSESSION_ERRONEOUS", "The supersession was wrong"],
  ["KNOWLEDGE_NO_LONGER_TRUE", "The knowledge is no longer true"],
  ["KNOWLEDGE_MISATTRIBUTED", "The knowledge is misattributed"],
  ["OTHER", "Another reason, described below"],
] as const

/** Stated on the three operations whose published precondition names it. */
const ReauthenticationNotice = () => (
  <p data-testid="lifecycle-reauth-notice" className="text-xs text-slate-600">
    This action may ask you to sign in again before it is applied.
  </p>
)

export type LifecycleFormProps = {
  readonly detail: KnowledgeDetail
  readonly controls: KnowledgeControls
  readonly supersession: SupersessionContext
  readonly csrfToken: string
  readonly idempotencyKeys: Readonly<Record<string, string>>
}

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
  </>
)

export const MarkActiveForm = ({
  detail,
  controls,
  csrfToken,
  idempotencyKeys,
}: LifecycleFormProps) =>
  controls.canMarkActive ? (
    <form
      action="/api/memory/activate"
      method="post"
      data-testid="lifecycle-activate"
      className={card}
    >
      <Hidden
        detail={detail}
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKeys["activate"] ?? ""}
      />
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
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">Mark active</h3>
        <p className="text-xs text-slate-600">
          Confirms this is current knowledge and lets retrieval return it. It records no
          review and changes no earlier decision.
        </p>
        <ReauthenticationNotice />
      </div>
      <div className={field}>
        <label htmlFor="activateNote" className={labelClass}>
          Note
        </label>
        <textarea
          id="activateNote"
          name="note"
          rows={2}
          maxLength={2000}
          className={control}
        />
      </div>
      <button type="submit" className={button}>
        Mark active
      </button>
    </form>
  ) : null

/**
 * Step one: choose the replacement.
 *
 * A read, so it is a `GET` form with no action. The selection lands in the URL
 * and the page re-renders with the confirmation below it.
 */
const SupersedePicker = ({ supersession }: { supersession: SupersessionContext }) => (
  <form method="get" data-testid="lifecycle-supersede-pick" className={card}>
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-slate-900">Mark superseded</h3>
      <p className="text-xs text-slate-600">
        Choose the newer Knowledge Object that replaces this one. Nothing is recorded
        until you confirm the direction on the next step.
      </p>
    </div>
    {supersession.candidates.length === 0 ? (
      <p className="text-sm text-slate-700">
        No reviewed Knowledge Object is available to replace this one. A replacement
        must already be approved or edited.
      </p>
    ) : (
      <>
        <div className={field}>
          <label htmlFor="supersedeWith" className={labelClass}>
            Replacement
          </label>
          <select
            id="supersedeWith"
            name="supersedeWith"
            required
            defaultValue=""
            className={control}
          >
            <option value="" disabled>
              Choose a Knowledge Object
            </option>
            {supersession.candidates.map((candidate) => (
              <option
                key={candidate.knowledgeObjectId}
                value={candidate.knowledgeObjectId}
              >
                {candidate.shortClaim} ({candidate.reviewLabel})
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={button}>
          Review the direction
        </button>
      </>
    )}
  </form>
)

/** Step two: confirm the direction, with all four tokens on screen. */
const SupersedeConfirm = ({
  detail,
  supersession,
  csrfToken,
  idempotencyKeys,
}: LifecycleFormProps) => {
  const target = supersession.target
  if (target === null) return null
  if (target.status === "unavailable") {
    return (
      <ConsoleUnavailable
        failure={target.failure}
        heading="The replacement you chose is not available"
      />
    )
  }

  return (
    <form
      action="/api/memory/supersede"
      method="post"
      data-testid="lifecycle-supersede-confirm"
      className={card}
    >
      <Hidden
        detail={detail}
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKeys["supersede"] ?? ""}
      />
      <input
        type="hidden"
        name="newKnowledgeObjectId"
        value={target.knowledgeObjectId}
      />
      {/* Four tokens, two per object, every one observed on this screen. */}
      <input
        type="hidden"
        name="expectedOldReviewSequence"
        value={String(detail.lifecycle.reviewSequence)}
      />
      <input
        type="hidden"
        name="expectedOldLifecycleVersion"
        value={String(detail.lifecycle.lifecycleVersion)}
      />
      <input
        type="hidden"
        name="expectedNewReviewSequence"
        value={String(target.reviewSequence)}
      />
      <input
        type="hidden"
        name="expectedNewLifecycleVersion"
        value={String(target.lifecycleVersion)}
      />
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">Confirm the direction</h3>
        {/* The direction is stated in words, not implied by layout. */}
        <p data-testid="supersede-direction" className="text-sm text-slate-900">
          <strong>{target.shortClaim}</strong> supersedes{" "}
          <strong>{detail.knowledge}</strong>.
        </p>
        <p className="text-xs text-slate-600">
          The newer object replaces this one. This one becomes superseded; the newer one
          is not activated by this, which is a separate decision.
        </p>
        <ReauthenticationNotice />
      </div>
      <div className={field}>
        <label htmlFor="supersedeNote" className={labelClass}>
          Note
        </label>
        <textarea
          id="supersedeNote"
          name="note"
          rows={2}
          maxLength={2000}
          className={control}
        />
      </div>
      <button type="submit" className={button}>
        Record that the newer object supersedes this one
      </button>
    </form>
  )
}

export const RequestCorrectionForm = ({
  detail,
  controls,
  csrfToken,
  idempotencyKeys,
}: LifecycleFormProps) => {
  if (!controls.canRequestCorrection) return null

  const relations = detail.lifecycle.supersededBy.filter(
    (edge) => edge.relationState === "ACTIVE",
  )

  return (
    <form
      action="/api/memory/corrections"
      method="post"
      data-testid="lifecycle-correction"
      className={card}
    >
      <Hidden
        detail={detail}
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKeys["correction"] ?? ""}
      />
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
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">
          Ask Evirion to correct this
        </h3>
        <p className="text-xs text-slate-600">
          {/* The customer creates and reads a request. Executing, declining
              and retrying one are Evirion operations. */}
          You are asking Evirion to make the change. Nothing moves until an Evirion
          operator applies it, and you can follow the request below.
        </p>
        <ReauthenticationNotice />
      </div>
      <div className={field}>
        <label htmlFor="requestType" className={labelClass}>
          What should change
        </label>
        <select
          id="requestType"
          name="requestType"
          required
          defaultValue=""
          className={control}
        >
          <option value="" disabled>
            Choose a correction
          </option>
          {CORRECTION_TYPES.map(([code, text]) => (
            <option key={code} value={code}>
              {text}
            </option>
          ))}
        </select>
      </div>
      {relations.length === 0 ? null : (
        <div className={field}>
          <label htmlFor="knowledgeRelationId" className={labelClass}>
            Which supersession
          </label>
          <select
            id="knowledgeRelationId"
            name="knowledgeRelationId"
            defaultValue=""
            className={control}
          >
            <option value="">Not applicable</option>
            {relations.map((edge) => (
              <option
                key={edge.knowledgeRelationId}
                // The relation version travels with the relation, so the pair
                // cannot be recombined into a version the backend never sent.
                value={`${edge.knowledgeRelationId}:${edge.relationVersion}`}
              >
                Superseded by {edge.knowledgeObjectId}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-600">
            Required when undoing a supersession.
          </p>
        </div>
      )}
      <div className={field}>
        <label htmlFor="correctionReasonCode" className={labelClass}>
          Reason
        </label>
        <select
          id="correctionReasonCode"
          name="reasonCode"
          required
          defaultValue=""
          className={control}
        >
          <option value="" disabled>
            Choose a reason
          </option>
          {CORRECTION_REASONS.map(([code, text]) => (
            <option key={code} value={code}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor="correctionNote" className={labelClass}>
          Note
        </label>
        <textarea
          id="correctionNote"
          name="note"
          rows={2}
          maxLength={2000}
          className={control}
        />
        <p className="text-xs text-slate-600">
          Required when the reason is &quot;Another reason&quot;.
        </p>
      </div>
      <button type="submit" className={button}>
        Send the request to Evirion
      </button>
    </form>
  )
}

export const LifecycleActions = (props: LifecycleFormProps) => {
  const { controls } = props
  const anything =
    controls.canMarkActive || controls.canSupersede || controls.canRequestCorrection

  return (
    <section
      aria-label="Lifecycle"
      data-testid="lifecycle-actions"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-slate-900">Lifecycle</h2>
        <p className="text-xs text-slate-600">
          Separate from review. Marking this active records no review decision, and
          reviewing it again later does not change its lifecycle.
        </p>
      </div>
      {anything ? null : (
        <p
          data-testid="lifecycle-actions-none"
          className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          No lifecycle action is available to you for this Knowledge Object in its
          current state.
        </p>
      )}
      <MarkActiveForm {...props} />
      {controls.canSupersede ? (
        <>
          <SupersedePicker supersession={props.supersession} />
          <SupersedeConfirm {...props} />
        </>
      ) : null}
      <RequestCorrectionForm {...props} />
    </section>
  )
}
