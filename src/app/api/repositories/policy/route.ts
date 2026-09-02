import type { NextRequest, NextResponse } from "next/server"

import {
  beginRepositoryCommand,
  finishRepositoryCommand,
  refuseRepositoryCommand,
} from "@/server/actions/repository-command"
import {
  type LiveRepositoryConsent,
  type RepositoryPolicyMode,
  updateRepositoryProcessingPolicy,
} from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

const MODES = new Set<string>(["OFF", "SOURCE_ONLY", "AUTO_EXTRACT"])
const RETRY_POLICIES = new Set<string>(["NO_RETRY", "BOUNDED_TRANSPORT_RETRY"])
const MODEL_PROFILE = /^[a-z][a-z0-9_.-]{0,63}$/

/** The contract wants exactly six fraction digits and refuses a zero ceiling. */
const budgetCeiling = (raw: string): string | undefined => {
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999) return undefined
  const fixed = amount.toFixed(6)
  return /^(0|[1-9][0-9]{0,11})\.[0-9]{6}$/.test(fixed) ? fixed : undefined
}

/** A local datetime becomes the exact instant form the contract publishes. */
const expiry = (raw: string): string | undefined => {
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) return undefined
  return `${parsed.toISOString().slice(0, 19)}Z`
}

const readConsent = (form: FormData): LiveRepositoryConsent | undefined => {
  const profiles = String(form.get("allowedModelProfiles") ?? "")
    .split(",")
    .map((profile) => profile.trim())
    .filter((profile) => profile !== "")

  const callCeiling = Number(form.get("callCeiling"))
  const budget = budgetCeiling(String(form.get("budgetCeilingUsd") ?? ""))
  const expiresAt = expiry(String(form.get("expiresAt") ?? ""))
  const retryPolicy = String(form.get("retryPolicy") ?? "")

  if (
    profiles.length === 0 ||
    profiles.length > 16 ||
    !profiles.every((profile) => MODEL_PROFILE.test(profile)) ||
    !Number.isInteger(callCeiling) ||
    callCeiling < 1 ||
    callCeiling > 1000000000 ||
    budget === undefined ||
    expiresAt === undefined ||
    !RETRY_POLICIES.has(retryPolicy)
  ) {
    return undefined
  }

  return {
    scope: "LIVE_REPOSITORY",
    allowedModelProfiles: profiles,
    callCeiling,
    budgetCeilingUsd: budget,
    retryPolicy: retryPolicy as LiveRepositoryConsent["retryPolicy"],
    expiresAt,
  }
}

/**
 * Change the live processing policy, and the consent that goes with it.
 *
 * `AUTO_EXTRACT` is the only mode that carries a consent, and an incomplete
 * one is refused rather than partially recorded: a half-built consent that the
 * backend then bounded would be worse than no consent at all. Moving back to
 * `OFF` or `SOURCE_ONLY` sends an explicit null, which revokes future dispatch
 * under the prior consent without erasing its history.
 *
 * Recording a consent never creates Evirion operational authorization. That is
 * a separate gate the customer cannot grant, and the surface says so.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginRepositoryCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields } = command
  const mode = String(fields.form.get("mode") ?? "") as RepositoryPolicyMode

  if (fields.expectedVersion === null || !MODES.has(mode)) {
    return refuseRepositoryCommand(fields.repositoryId, "REQUEST_INVALID")
  }

  const consent = mode === "AUTO_EXTRACT" ? readConsent(fields.form) : null
  if (mode === "AUTO_EXTRACT" && consent === undefined) {
    return refuseRepositoryCommand(fields.repositoryId, "REQUEST_INVALID")
  }

  return finishRepositoryCommand(
    fields.repositoryId,
    await updateRepositoryProcessingPolicy(scope, {
      repositoryId: fields.repositoryId,
      expectedVersion: fields.expectedVersion,
      mode,
      consent: consent ?? null,
      idempotencyKey: fields.idempotencyKey,
    }),
  )
}
