import type { NextRequest, NextResponse } from "next/server"

import {
  beginRepositoryCommand,
  finishRepositoryCommand,
  refuseRepositoryCommand,
} from "@/server/actions/repository-command"
import { activateRepositoryEntitlement } from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

/**
 * Activate or reactivate one repository entitlement.
 *
 * `expectedVersion` is null for a first activation and the backend's own
 * version otherwise; either way it travels in the body, because the contract
 * declares no expected-version header and one sent that way would be dropped.
 * Capacity is never judged here: a one-slot race is decided under lock by the
 * backend, and its answer is what the customer is shown.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginRepositoryCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields } = command

  // REPO-002 requires an explicit confirmation and the contract fixes the
  // field to `true`, so an unticked box is refused rather than defaulted.
  if (fields.form.get("confirmationAccepted") !== "on") {
    return refuseRepositoryCommand(fields.repositoryId, "REQUEST_INVALID")
  }

  return finishRepositoryCommand(
    fields.repositoryId,
    await activateRepositoryEntitlement(scope, {
      repositoryId: fields.repositoryId,
      expectedVersion: fields.expectedVersion,
      idempotencyKey: fields.idempotencyKey,
    }),
  )
}
