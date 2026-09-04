import type { NextRequest, NextResponse } from "next/server"

import {
  beginKnowledgeCommand,
  finishKnowledgeCommand,
  guardKnowledgeFreshness,
  knowledgePendingMutation,
  readExpectedSequence,
  refuseKnowledgeCommand,
} from "@/server/actions/knowledge-command"
import { markKnowledgeActive } from "@/server/adapters/knowledge"

export const dynamic = "force-dynamic"

/**
 * Confirm that a Knowledge Object is current.
 *
 * Activation is the lifecycle axis and records no review. The backend requires
 * an eligible current `APPROVED` or `EDITED` review as well as both observed
 * tokens, and refuses with a stable identifier when either is wrong.
 *
 * The contract also names recent reauthentication as a precondition. No field
 * of the live session projection says whether that is satisfied, so nothing
 * here claims it is: the request is sent and the refusal is rendered.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginKnowledgeCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields, sessionContext } = command
  const pending = knowledgePendingMutation(fields, "/api/memory/activate")
  const stale = await guardKnowledgeFreshness(sessionContext, pending)
  if (stale) return stale

  const expectedReviewSequence = readExpectedSequence(
    fields.form,
    "expectedReviewSequence",
  )
  const expectedLifecycleVersion = readExpectedSequence(
    fields.form,
    "expectedLifecycleVersion",
  )

  if (expectedReviewSequence === undefined || expectedLifecycleVersion === undefined) {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }

  const note = String(fields.form.get("note") ?? "").trim()

  return finishKnowledgeCommand(
    fields.knowledgeObjectId,
    await markKnowledgeActive(scope, {
      knowledgeObjectId: fields.knowledgeObjectId,
      idempotencyKey: fields.idempotencyKey,
      expectedReviewSequence,
      expectedLifecycleVersion,
      ...(note === "" ? {} : { note }),
    }),
    pending,
    sessionContext,
  )
}
