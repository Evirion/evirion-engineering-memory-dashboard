import type { NextRequest, NextResponse } from "next/server"

import {
  beginImportCommand,
  finishImportCommand,
  guardImportFreshness,
  importPendingMutation,
  readExpectedStatus,
  readImportId,
  refuseImportCommand,
} from "@/server/actions/import-command"
import { approveRepositoryImport } from "@/server/adapters/imports"

export const dynamic = "force-dynamic"

const BUDGET = /^(0|[1-9][0-9]{0,11})\.[0-9]{6}$/
const REFUSED_BUDGET = "0.000000"
const LARGEST_BUDGET = 999999999999

/**
 * The cost budget in exactly the form the contract accepts.
 *
 * Exported so the edges are provable without a running server. Positive is not
 * the same as non-zero once it is rounded: anything under a microdollar
 * becomes exactly the value the schema refuses, so it is rejected here rather
 * than sent as a body the backend would bounce.
 */
export const readApprovedBudget = (raw: string): string | undefined => {
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0 || amount > LARGEST_BUDGET) {
    return undefined
  }

  const fixed = amount.toFixed(6)
  if (fixed === REFUSED_BUDGET) return undefined

  return BUDGET.test(fixed) ? fixed : undefined
}

/**
 * Record the customer's consent to paid extraction for one import.
 *
 * This is customer consent and nothing more. It does not create Evirion
 * operational authorization, which no customer route can grant, so the
 * projection may still report a wait once this succeeds. The surface says so
 * before the control is used and after it is.
 *
 * The optimistic token is the status the customer was shown, because
 * `core.backfill_runs` carries no version column. A stale one conflicts
 * exactly as a stale version does.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginImportCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields, sessionContext } = command
  const pending = importPendingMutation(fields, "/api/imports/approve")
  const stale = await guardImportFreshness(sessionContext, pending)
  if (stale) return stale

  const importId = readImportId(fields.form)
  const expectedStatus = readExpectedStatus(fields.form)
  const costBudgetUsd = readApprovedBudget(
    String(fields.form.get("costBudgetUsd") ?? ""),
  )

  if (
    importId === undefined ||
    expectedStatus === undefined ||
    costBudgetUsd === undefined
  ) {
    return refuseImportCommand(fields.repositoryId, "REQUEST_INVALID")
  }

  return finishImportCommand(
    fields.repositoryId,
    await approveRepositoryImport(scope, {
      importId,
      idempotencyKey: fields.idempotencyKey,
      expectedStatus,
      costBudgetUsd,
    }),
    pending,
    sessionContext,
  )
}
