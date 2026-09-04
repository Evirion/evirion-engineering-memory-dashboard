import type { NextRequest, NextResponse } from "next/server"

import {
  beginImportCommand,
  finishImportCommand,
  guardImportFreshness,
  importPendingMutation,
  refuseImportCommand,
} from "@/server/actions/import-command"
import {
  type RepositoryImportFilters,
  createRepositoryImport,
} from "@/server/adapters/imports"

export const dynamic = "force-dynamic"

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/
const MONTHS_IN_A_YEAR = 12

/** The three ranges the requirement fixes. Anything else is refused. */
const RANGES = new Set(["ENTIRE_HISTORY", "LAST_12_MONTHS", "CUSTOM"])

/** A calendar day becomes the instant form the contract publishes. */
const instant = (day: string, endOfDay: boolean): string | undefined => {
  if (!CALENDAR_DAY.test(day)) return undefined
  const parsed = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return undefined
  // A calendar date that does not exist still parses if it is only pattern
  // checked, so the round trip is what proves February 30th is refused.
  if (parsed.toISOString().slice(0, 10) !== day) return undefined
  return `${day}T${endOfDay ? "23:59:59" : "00:00:00"}Z`
}

/**
 * Turn the chosen range into the bounded merge window the contract accepts.
 *
 * Exported so the edges are provable without a running server. Omitting both
 * bounds is how the contract asks for the entire history, so it is a complete
 * answer rather than a missing one. A custom range must carry both bounds and
 * they must be in order; the customer picks whole days, and the upper bound is
 * inclusive, which is what a merge window reads as.
 */
export const readImportFilters = (
  form: FormData,
): RepositoryImportFilters | undefined => {
  const range = String(form.get("range") ?? "")
  if (!RANGES.has(range)) return undefined
  if (range === "ENTIRE_HISTORY") return {}

  if (range === "LAST_12_MONTHS") {
    const from = new Date()
    from.setUTCMonth(from.getUTCMonth() - MONTHS_IN_A_YEAR)
    // No upper bound: the window runs to the present, and naming an upper
    // bound of "now" would only add a clock-skew edge for no gain.
    return { mergedFrom: `${from.toISOString().slice(0, 19)}Z` }
  }

  const mergedFrom = instant(String(form.get("mergedFrom") ?? ""), false)
  const mergedTo = instant(String(form.get("mergedTo") ?? ""), true)
  if (mergedFrom === undefined || mergedTo === undefined) return undefined
  if (mergedFrom > mergedTo) return undefined

  return { mergedFrom, mergedTo }
}

/**
 * Prepare a historical import.
 *
 * Discovery and Source Envelope preparation are free stages, so nothing here
 * needs a paid approval. The customer API fixes the mode to `MISSING_ONLY` and
 * the contract's create body admits no mode field, so `reextract` cannot be
 * requested from this surface at all.
 *
 * A duplicate click replays: the key is minted once per rendered form, so the
 * second request returns the stored receipt instead of starting a second run.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginImportCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields, sessionContext } = command
  const pending = importPendingMutation(fields, "/api/imports/prepare")
  const stale = await guardImportFreshness(sessionContext, pending)
  if (stale) return stale

  const filters = readImportFilters(fields.form)
  if (filters === undefined) {
    return refuseImportCommand(fields.repositoryId, "REQUEST_INVALID")
  }

  return finishImportCommand(
    fields.repositoryId,
    await createRepositoryImport(scope, {
      repositoryId: fields.repositoryId,
      idempotencyKey: fields.idempotencyKey,
      filters,
    }),
    pending,
    sessionContext,
  )
}
