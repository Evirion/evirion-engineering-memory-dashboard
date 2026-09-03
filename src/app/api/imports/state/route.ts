import type { NextRequest, NextResponse } from "next/server"

import {
  beginImportCommand,
  finishImportCommand,
  readExpectedStatus,
  readImportId,
  refuseImportCommand,
} from "@/server/actions/import-command"
import {
  type RepositoryImportState,
  setRepositoryImportState,
} from "@/server/adapters/imports"

export const dynamic = "force-dynamic"

const STATES = new Set<string>(["PAUSED", "RESUMED", "CANCELLED"])

/**
 * Pause, resume or cancel one import.
 *
 * Which of the three is even offered comes from the backend `capabilities`
 * projection, not from the status the page happens to be rendering. A control
 * the backend does not permit is not drawn, and reaching this route anyway
 * still gets the backend's refusal rather than a local decision.
 *
 * A resume the backend forces back to `PAUSED` because source dead-letter work
 * remains is a completed command with its own response code. It travels back
 * as itself so the surface can explain it, rather than as a plain success.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginImportCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields } = command
  const importId = readImportId(fields.form)
  const expectedStatus = readExpectedStatus(fields.form)
  const state = String(fields.form.get("state") ?? "")

  if (importId === undefined || expectedStatus === undefined || !STATES.has(state)) {
    return refuseImportCommand(fields.repositoryId, "REQUEST_INVALID")
  }

  return finishImportCommand(
    fields.repositoryId,
    await setRepositoryImportState(scope, {
      importId,
      idempotencyKey: fields.idempotencyKey,
      state: state as RepositoryImportState,
      expectedStatus,
    }),
  )
}
