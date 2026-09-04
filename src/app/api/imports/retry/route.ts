import type { NextRequest, NextResponse } from "next/server"

import {
  beginImportCommand,
  finishImportCommand,
  guardImportFreshness,
  importPendingMutation,
  readImportId,
  refuseImportCommand,
} from "@/server/actions/import-command"
import { retryRepositoryImportJob } from "@/server/adapters/imports"
import { isUuid } from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

/**
 * Retry one failed import job the backend has declared retryable.
 *
 * This is not the generic processing-job Retry, which `/processing` owns. It
 * exists only for a failure whose own projection carries `retryable` and a
 * recovery action, and the control is drawn from that projection rather than
 * from the fact that something failed. Retryability is never derived here.
 *
 * The operation takes no body, so there is nothing for a caller to assert
 * about whether the work may run again.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginImportCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields, sessionContext } = command
  const pending = importPendingMutation(fields, "/api/imports/retry")
  const stale = await guardImportFreshness(sessionContext, pending)
  if (stale) return stale

  const importId = readImportId(fields.form)
  const extractionJobId = String(fields.form.get("extractionJobId") ?? "")

  if (importId === undefined || !isUuid(extractionJobId)) {
    return refuseImportCommand(fields.repositoryId, "REQUEST_INVALID")
  }

  return finishImportCommand(
    fields.repositoryId,
    await retryRepositoryImportJob(scope, {
      importId,
      idempotencyKey: fields.idempotencyKey,
      extractionJobId,
    }),
    pending,
    sessionContext,
  )
}
