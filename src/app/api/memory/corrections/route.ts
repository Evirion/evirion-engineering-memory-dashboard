import type { NextRequest, NextResponse } from "next/server"

import {
  beginKnowledgeCommand,
  finishKnowledgeCommand,
  readExpectedSequence,
  refuseKnowledgeCommand,
} from "@/server/actions/knowledge-command"
import {
  type KnowledgeCorrectionReasonCode,
  type KnowledgeCorrectionRequestType,
  requestKnowledgeCorrection,
} from "@/server/adapters/knowledge"
import { isUuid } from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

const TYPES: readonly KnowledgeCorrectionRequestType[] = [
  "RETRACT_SUPERSESSION",
  "WITHDRAW_ACTIVE_KNOWLEDGE",
  "RESTORE_UNRESOLVED",
]

const REASONS: readonly KnowledgeCorrectionReasonCode[] = [
  "SUPERSESSION_ERRONEOUS",
  "KNOWLEDGE_NO_LONGER_TRUE",
  "KNOWLEDGE_MISATTRIBUTED",
  "OTHER",
]

/**
 * The relation and the version it carried, as one inseparable value.
 *
 * The form submits them together so a caller cannot pair one relation with
 * another's version, which would let a stale relation pass the optimistic
 * check that exists to catch exactly that.
 */
const readRelation = (
  raw: string,
): { readonly id: string; readonly version: number } | undefined => {
  const [id, version] = raw.split(":")
  if (id === undefined || !isUuid(id)) return undefined
  if (version === undefined || !/^\d{1,15}$/.test(version)) return undefined
  return { id, version: Number(version) }
}

/**
 * Ask an Evirion operator to correct a lifecycle outcome.
 *
 * The customer creates and reads a request. Nothing on this surface can
 * execute, decline or retry one: those are operator commands on a separate
 * non-browser API, and no route here reaches them.
 *
 * A `RETRACT_SUPERSESSION` request is the only one that names a relation, and
 * it carries that relation's own version as a third optimistic token. The
 * other two request types must name no relation at all.
 *
 * The contract also names recent reauthentication as a precondition, which no
 * session field reports. The request is sent and the refusal is rendered.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginKnowledgeCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields } = command
  const form = fields.form

  const requestType = TYPES.find((value) => value === form.get("requestType"))
  const reasonCode = REASONS.find((value) => value === form.get("reasonCode"))
  const expectedReviewSequence = readExpectedSequence(form, "expectedReviewSequence")
  const expectedLifecycleVersion = readExpectedSequence(
    form,
    "expectedLifecycleVersion",
  )

  if (
    requestType === undefined ||
    reasonCode === undefined ||
    expectedReviewSequence === undefined ||
    expectedLifecycleVersion === undefined
  ) {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }

  const note = String(form.get("note") ?? "").trim()
  // `OTHER` carries no meaning on its own, so the backend requires a note
  // beside it. Sending one without would be a refusal this route can avoid.
  if (reasonCode === "OTHER" && note === "") {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }

  const retracting = requestType === "RETRACT_SUPERSESSION"
  const raw = String(form.get("knowledgeRelationId") ?? "")
  const relation = raw === "" ? undefined : readRelation(raw)

  if (retracting && relation === undefined) {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }
  if (!retracting && relation !== undefined) {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }

  return finishKnowledgeCommand(
    fields.knowledgeObjectId,
    await requestKnowledgeCorrection(scope, {
      knowledgeObjectId: fields.knowledgeObjectId,
      idempotencyKey: fields.idempotencyKey,
      requestType,
      reasonCode,
      expectedReviewSequence,
      expectedLifecycleVersion,
      ...(relation === undefined
        ? {}
        : {
            knowledgeRelationId: relation.id,
            expectedRelationVersion: relation.version,
          }),
      ...(note === "" ? {} : { note }),
    }),
  )
}
