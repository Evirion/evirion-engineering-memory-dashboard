import type { NextRequest, NextResponse } from "next/server"

import {
  beginRepositoryCommand,
  finishRepositoryCommand,
  refuseRepositoryCommand,
} from "@/server/actions/repository-command"
import {
  isUuid,
  requestRepositoryEntitlementChange,
} from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

/**
 * Ask an Evirion operator to replace one entitled repository with another.
 *
 * This is what limited Alpha offers instead of self-service rotation. It
 * records a request and changes no entitlement: the slot is not freed, the
 * replacement is not applied, and the customer is told to wait rather than
 * shown a control that appears to have done something.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginRepositoryCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields } = command
  const requestedRepositoryId = String(fields.form.get("requestedRepositoryId") ?? "")
  const reason = fields.form.get("reason")

  if (fields.expectedVersion === null || !isUuid(requestedRepositoryId)) {
    return refuseRepositoryCommand(fields.repositoryId, "REQUEST_INVALID")
  }

  return finishRepositoryCommand(
    fields.repositoryId,
    await requestRepositoryEntitlementChange(scope, {
      repositoryId: fields.repositoryId,
      requestedRepositoryId,
      expectedVersion: fields.expectedVersion,
      idempotencyKey: fields.idempotencyKey,
      ...(typeof reason === "string" ? { reason } : {}),
    }),
  )
}
