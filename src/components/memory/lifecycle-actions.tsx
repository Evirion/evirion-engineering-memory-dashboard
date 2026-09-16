import type { KnowledgeDetail } from "@contracts/console"

import { GatedForm } from "@/components/auth/gated-form"
import { ReauthenticationPreconditionNotice } from "@/components/auth/reauthentication-notice"
import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import type { KnowledgeControls } from "@/lib/knowledge/presentation"
import type { SupersessionContext } from "@/server/queries/knowledge"
import { buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldHint,
  Label,
  RequiredFieldError,
  Select,
  Textarea,
} from "@/components/ui/field"
import { panelVariants } from "@/components/ui/panel"
import { SubmitButton } from "@/components/ui/submit-button"

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

const card = panelVariants({ className: "flex flex-col gap-3" })
const button = buttonVariants({ variant: "primary", className: "self-start" })

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
const ReauthenticationNotice = ReauthenticationPreconditionNotice

export type LifecycleFormProps = {
  readonly detail: KnowledgeDetail
  readonly controls: KnowledgeControls
  readonly supersession: SupersessionContext
  readonly csrfToken: string
  readonly idempotencyKeys: Readonly<Record<string, string>>
  readonly reauthenticationFreshUntil?: string | null | undefined
  readonly knowledgeReturnPath: string
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
  reauthenticationFreshUntil,
  knowledgeReturnPath,
}: LifecycleFormProps) =>
  controls.canMarkActive ? (
    <GatedForm
      action="/api/memory/activate"
      freshUntil={reauthenticationFreshUntil}
      gate="knowledge_lifecycle"
      returnPath={knowledgeReturnPath}
      mutationPath="/api/memory/activate"
      dataTestId="lifecycle-activate"
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
        <h3 className="text-sm font-semibold text-foreground">Mark active</h3>
        <p className="text-xs text-ink-secondary">
          Confirms this is current knowledge and lets retrieval return it. It records no
          review and changes no earlier decision.
        </p>
        <ReauthenticationNotice testId="lifecycle-reauth-notice" />
      </div>
      <Field>
        <Label htmlFor="activateNote">Note</Label>
        <Textarea id="activateNote" name="note" rows={2} maxLength={2000} />
      </Field>
      <SubmitButton className={button}>Mark active</SubmitButton>
    </GatedForm>
  ) : null

/**
 * Step one: choose the replacement.
 *
 * A read, so it is a `GET` form with no action. The selection lands in the URL
 * and the page re-renders with the confirmation below it.
 */
const SupersedePicker = ({ supersession }: { supersession: SupersessionContext }) => {
  const selectedId =
    supersession.target?.status === "ready"
      ? supersession.target.knowledgeObjectId
      : undefined

  return (
    <form method="get" data-testid="lifecycle-supersede-pick" className={card}>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Mark superseded</h3>
        <p className="text-xs text-ink-secondary">
          Choose the newer Knowledge Object that replaces this one. Nothing is recorded
          until you confirm the direction on the next step.
        </p>
      </div>
      {supersession.candidates.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          No reviewed Knowledge Object is available to replace this one. A replacement
          must already be approved or edited.
        </p>
      ) : (
        <>
          <Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-foreground">
                Replacement
                <span aria-hidden className="text-destructive">
                  {" "}
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </legend>
              {supersession.candidates.map((candidate) => (
                <label
                  key={candidate.knowledgeObjectId}
                  aria-label={`${candidate.shortClaim}, ${candidate.knowledgeType}, ${candidate.reviewLabel}`}
                  className="border-input bg-card hover:border-line-strong has-checked:border-ring has-checked:bg-accent flex cursor-pointer gap-3 rounded-lg border px-3 py-3 text-sm transition-colors"
                >
                  <input
                    type="radio"
                    data-slot="input"
                    name="supersedeWith"
                    value={candidate.knowledgeObjectId}
                    required
                    defaultChecked={selectedId === candidate.knowledgeObjectId}
                    aria-describedby="supersedeWith-error"
                    className="accent-primary user-invalid:border-destructive mt-1 size-4 shrink-0"
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-foreground line-clamp-2 font-medium leading-snug">
                      {candidate.shortClaim}
                    </span>
                    <span className="text-ink-secondary text-xs">
                      {candidate.knowledgeType} · {candidate.reviewLabel}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <RequiredFieldError id="supersedeWith-error" />
          </Field>
          <SubmitButton className={button}>Review the direction</SubmitButton>
        </>
      )}
    </form>
  )
}

/** Step two: confirm the direction, with all four tokens on screen. */
const SupersedeConfirm = ({
  detail,
  supersession,
  csrfToken,
  idempotencyKeys,
  reauthenticationFreshUntil,
  knowledgeReturnPath,
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
    <GatedForm
      action="/api/memory/supersede"
      freshUntil={reauthenticationFreshUntil}
      gate="knowledge_lifecycle"
      returnPath={knowledgeReturnPath}
      mutationPath="/api/memory/supersede"
      dataTestId="lifecycle-supersede-confirm"
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
        <h3 className="text-sm font-semibold text-foreground">Confirm the direction</h3>
        {/* The direction is stated in words, not implied by layout. */}
        <p data-testid="supersede-direction" className="text-sm text-foreground">
          <strong>{target.shortClaim}</strong> supersedes{" "}
          <strong>{detail.knowledge}</strong>.
        </p>
        <p className="text-xs text-ink-secondary">
          The newer object replaces this one. This one becomes superseded; the newer one
          is not activated by this, which is a separate decision.
        </p>
        <ReauthenticationNotice testId="lifecycle-reauth-notice" />
      </div>
      <Field>
        <Label htmlFor="supersedeNote">Note</Label>
        <Textarea id="supersedeNote" name="note" rows={2} maxLength={2000} />
      </Field>
      <SubmitButton className={button}>
        Record that the newer object supersedes this one
      </SubmitButton>
    </GatedForm>
  )
}

export const RequestCorrectionForm = ({
  detail,
  controls,
  csrfToken,
  idempotencyKeys,
  reauthenticationFreshUntil,
  knowledgeReturnPath,
}: LifecycleFormProps) => {
  if (!controls.canRequestCorrection) return null

  const relations = detail.lifecycle.supersededBy.filter(
    (edge) => edge.relationState === "ACTIVE",
  )

  return (
    <GatedForm
      action="/api/memory/corrections"
      freshUntil={reauthenticationFreshUntil}
      gate="knowledge_lifecycle"
      returnPath={knowledgeReturnPath}
      mutationPath="/api/memory/corrections"
      dataTestId="lifecycle-correction"
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
        <h3 className="text-sm font-semibold text-foreground">
          Ask Evirion to correct this
        </h3>
        <p className="text-xs text-ink-secondary">
          {/* The customer creates and reads a request. Executing, declining
              and retrying one are Evirion operations. */}
          You are asking Evirion to make the change. Nothing moves until an Evirion
          operator applies it, and you can follow the request below.
        </p>
        <ReauthenticationNotice testId="lifecycle-reauth-notice" />
      </div>
      <Field>
        <Label htmlFor="requestType" required>
          What should change
        </Label>
        <Select
          id="requestType"
          name="requestType"
          required
          aria-describedby="requestType-error"
          defaultValue=""
        >
          <option value="" disabled>
            Choose a correction
          </option>
          {CORRECTION_TYPES.map(([code, text]) => (
            <option key={code} value={code}>
              {text}
            </option>
          ))}
        </Select>
        <RequiredFieldError id="requestType-error" />
      </Field>
      {relations.length === 0 ? null : (
        <Field>
          <Label htmlFor="knowledgeRelationId">Which supersession</Label>
          <Select id="knowledgeRelationId" name="knowledgeRelationId" defaultValue="">
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
          </Select>
          <FieldHint>Required when undoing a supersession.</FieldHint>
        </Field>
      )}
      <Field>
        <Label htmlFor="correctionReasonCode" required>
          Reason
        </Label>
        <Select
          id="correctionReasonCode"
          name="reasonCode"
          required
          aria-describedby="correctionReasonCode-error"
          defaultValue=""
        >
          <option value="" disabled>
            Choose a reason
          </option>
          {CORRECTION_REASONS.map(([code, text]) => (
            <option key={code} value={code}>
              {text}
            </option>
          ))}
        </Select>
        <RequiredFieldError id="correctionReasonCode-error" />
      </Field>
      <Field>
        <Label htmlFor="correctionNote">Note</Label>
        <Textarea id="correctionNote" name="note" rows={2} maxLength={2000} />
        <FieldHint>Required when the reason is &quot;Another reason&quot;.</FieldHint>
      </Field>
      <SubmitButton className={button}>Send the request to Evirion</SubmitButton>
    </GatedForm>
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
        <h2 className="text-sm font-semibold text-foreground">Lifecycle</h2>
        <p className="text-xs text-ink-secondary">
          Separate from review. Marking this active records no review decision, and
          reviewing it again later does not change its lifecycle.
        </p>
      </div>
      {anything ? null : (
        <p
          data-testid="lifecycle-actions-none"
          className="rounded-2xl border border-border bg-muted px-5 py-4 text-sm text-ink-secondary"
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
