import type { NextRequest, NextResponse } from "next/server"

import {
  beginKnowledgeCommand,
  finishKnowledgeCommand,
  readExpectedSequence,
  refuseKnowledgeCommand,
} from "@/server/actions/knowledge-command"
import {
  type KnowledgeEditPayload,
  type KnowledgeIssueSeverity,
  type KnowledgeRejectReasonCode,
  type KnowledgeReviewAction,
  recordKnowledgeReview,
} from "@/server/adapters/knowledge"

export const dynamic = "force-dynamic"

const ACTIONS: readonly KnowledgeReviewAction[] = [
  "APPROVE",
  "EDIT",
  "USER_REJECT",
  "REVERT_TO_ORIGINAL_AND_APPROVE",
]

const REASONS: readonly KnowledgeRejectReasonCode[] = [
  "INCORRECT",
  "NOT_DURABLE",
  "UNSUPPORTED",
  "TOO_VAGUE",
  "DUPLICATE",
  "OUTDATED",
  "OTHER",
]

const SEVERITIES: readonly KnowledgeIssueSeverity[] = [
  "NONE",
  "MINOR",
  "MAJOR",
  "CRITICAL",
]

/** The eleven free-text keys the reviewer fills, plus the two carried through. */
const TEXT_FIELDS = ["problem", "knowledge", "designRationale", "futureImpact"] as const

const LIST_FIELDS = [
  "documentedTradeoffs",
  "explicitAlternatives",
  "constraints",
  "invariants",
  "failureModes",
  "affectedSystems",
  "answerableQuestions",
] as const

const text = (form: FormData, key: string): string => String(form.get(key) ?? "").trim()

/** One entry per line, blank lines dropped. */
const lines = (form: FormData, key: string): string[] =>
  text(form, key)
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")

/**
 * The complete editable projection, or nothing.
 *
 * `REV-002` defines an edit as a full reviewed derivative rather than a patch,
 * so all thirteen keys are required. A partial form is refused here rather
 * than sent as a body the backend would bounce, and it is never completed with
 * a value this route invented.
 */
const readEdit = (form: FormData): KnowledgeEditPayload | undefined => {
  const knowledgeType = text(form, "knowledgeType")
  const implementationStatus = text(form, "implementationStatus")
  if (knowledgeType === "" || implementationStatus === "") return undefined

  const strings = Object.fromEntries(
    TEXT_FIELDS.map((key) => [key, text(form, key)]),
  ) as Record<(typeof TEXT_FIELDS)[number], string>
  if (Object.values(strings).some((value) => value === "")) return undefined

  const arrays = Object.fromEntries(
    LIST_FIELDS.map((key) => [key, lines(form, key)]),
  ) as Record<(typeof LIST_FIELDS)[number], string[]>
  if (Object.values(arrays).some((value) => value.length === 0)) return undefined

  return { knowledgeType, implementationStatus, ...strings, ...arrays }
}

/**
 * Record one immutable review decision.
 *
 * Both optimistic tokens are forwarded exactly as the page rendered them and
 * are never synthesised. They go stale independently, so the backend can
 * refuse with `REVIEW_VERSION_CONFLICT` or `LIFECYCLE_VERSION_CONFLICT` and
 * the surface reports whichever it received.
 *
 * The action-to-field combinations are the backend's authority. This route
 * refuses only what it can judge without asking: an action or code the
 * contract does not publish, an incomplete editable projection, and a missing
 * token. It never repairs a request into a different decision than the
 * reviewer made.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginKnowledgeCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields } = command
  const form = fields.form

  const action = ACTIONS.find((value) => value === form.get("action"))
  const expectedReviewSequence = readExpectedSequence(form, "expectedReviewSequence")
  const expectedLifecycleVersion = readExpectedSequence(
    form,
    "expectedLifecycleVersion",
  )

  if (
    action === undefined ||
    expectedReviewSequence === undefined ||
    expectedLifecycleVersion === undefined
  ) {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }

  const edit = action === "EDIT" ? readEdit(form) : undefined
  if (action === "EDIT" && edit === undefined) {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }

  const rejectReasonCode =
    action === "USER_REJECT"
      ? REASONS.find((value) => value === form.get("rejectReasonCode"))
      : undefined
  if (action === "USER_REJECT" && rejectReasonCode === undefined) {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }

  const issueSeverity =
    action === "EDIT" || action === "USER_REJECT"
      ? SEVERITIES.find((value) => value === form.get("issueSeverity"))
      : undefined
  if ((action === "EDIT" || action === "USER_REJECT") && issueSeverity === undefined) {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }

  const note = text(form, "note")

  return finishKnowledgeCommand(
    fields.knowledgeObjectId,
    await recordKnowledgeReview(scope, {
      knowledgeObjectId: fields.knowledgeObjectId,
      idempotencyKey: fields.idempotencyKey,
      action,
      expectedReviewSequence,
      expectedLifecycleVersion,
      ...(edit === undefined ? {} : { edit }),
      ...(rejectReasonCode === undefined ? {} : { rejectReasonCode }),
      ...(issueSeverity === undefined ? {} : { issueSeverity }),
      ...(note === "" ? {} : { note }),
    }),
  )
}
