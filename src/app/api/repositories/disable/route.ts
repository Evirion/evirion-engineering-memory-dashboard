import type { NextRequest, NextResponse } from "next/server"

import {
  beginRepositoryCommand,
  finishRepositoryCommand,
  refuseRepositoryCommand,
} from "@/server/actions/repository-command"
import { disableRepositoryEntitlement } from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

/**
 * Disable one repository entitlement.
 *
 * Whether a customer may do this at all is the organization's replacement
 * mode, which only the backend knows. Under `OPERATOR_ONLY` this route is not
 * rendered and the backend also refuses it, which is the point: hiding the
 * control is a convenience and never the authorization.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginRepositoryCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields } = command

  // Disable is a version-carrying command; there is no first-disable case.
  if (fields.expectedVersion === null) {
    return refuseRepositoryCommand(fields.repositoryId, "REQUEST_INVALID")
  }

  const reason = fields.form.get("reason")

  return finishRepositoryCommand(
    fields.repositoryId,
    await disableRepositoryEntitlement(scope, {
      repositoryId: fields.repositoryId,
      expectedVersion: fields.expectedVersion,
      idempotencyKey: fields.idempotencyKey,
      ...(typeof reason === "string" ? { reason } : {}),
    }),
  )
}
