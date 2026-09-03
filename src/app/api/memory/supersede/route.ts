import type { NextRequest, NextResponse } from "next/server"

import {
  beginKnowledgeCommand,
  finishKnowledgeCommand,
  readExpectedSequence,
  refuseKnowledgeCommand,
} from "@/server/actions/knowledge-command"
import { markKnowledgeSuperseded } from "@/server/adapters/knowledge"
import { isUuid } from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

/**
 * Record that a newer Knowledge Object supersedes this one.
 *
 * The path identifies the object being superseded and the body names the one
 * replacing it, so the relation the backend stores is `new SUPERSEDES old`.
 * Four tokens travel, two per object, and every one of them was rendered on
 * the confirmation step the reviewer just read.
 *
 * The backend owns eligibility, cycle detection and the traversal bound. This
 * route refuses only what it can judge without asking: a malformed identifier,
 * a missing token, and superseding an object by itself.
 *
 * The contract also names recent reauthentication as a precondition, which no
 * session field reports. The request is sent and the refusal is rendered.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginKnowledgeCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields } = command
  const form = fields.form
  const newKnowledgeObjectId = String(form.get("newKnowledgeObjectId") ?? "")

  const oldReview = readExpectedSequence(form, "expectedOldReviewSequence")
  const oldLifecycle = readExpectedSequence(form, "expectedOldLifecycleVersion")
  const newReview = readExpectedSequence(form, "expectedNewReviewSequence")
  const newLifecycle = readExpectedSequence(form, "expectedNewLifecycleVersion")

  if (
    !isUuid(newKnowledgeObjectId) ||
    // Self supersession has no meaning and reaches nothing.
    newKnowledgeObjectId === fields.knowledgeObjectId ||
    oldReview === undefined ||
    oldLifecycle === undefined ||
    newReview === undefined ||
    newLifecycle === undefined
  ) {
    return refuseKnowledgeCommand(fields.knowledgeObjectId, "REQUEST_INVALID")
  }

  const note = String(form.get("note") ?? "").trim()

  return finishKnowledgeCommand(
    fields.knowledgeObjectId,
    await markKnowledgeSuperseded(scope, {
      knowledgeObjectId: fields.knowledgeObjectId,
      idempotencyKey: fields.idempotencyKey,
      newKnowledgeObjectId,
      expectedOldReviewSequence: oldReview,
      expectedOldLifecycleVersion: oldLifecycle,
      expectedNewReviewSequence: newReview,
      expectedNewLifecycleVersion: newLifecycle,
      ...(note === "" ? {} : { note }),
    }),
  )
}
