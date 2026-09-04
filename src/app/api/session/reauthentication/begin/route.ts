import { NextResponse, type NextRequest } from "next/server"

import {
  actionClassForGate,
  isAllowedMutationPath,
  type ReauthenticationGate,
} from "@/lib/auth/reauthentication-action-class"
import { normalizeReturnPath } from "@/lib/auth/reauthentication-return-path"
import { formFieldsFrom } from "@/lib/auth/reauthentication-state"
import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"
import {
  redirectForReauthentication,
  storeChallenge,
} from "@/server/actions/reauthentication-resume"
import { issueSessionReauthentication } from "@/server/adapters/reauthentication"

export const dynamic = "force-dynamic"

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

const issueFailureCode = (
  issued: Awaited<ReturnType<typeof issueSessionReauthentication>>,
): string => {
  if (issued.ok) return ""
  if (issued.failure.kind === "error") return issued.failure.error.error.code
  if (issued.failure.kind === "unreachable") return "DEPENDENCY_UNAVAILABLE"
  return "UNSUPPORTED_SERVER_RESPONSE"
}

/**
 * Store the gated mutation the customer was about to send and start step-up.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const form = guard.form
  const gate = String(form.get("gate") ?? "")
  const returnPath = normalizeReturnPath(String(form.get("returnPath") ?? ""))
  const mutationPath = String(form.get("mutationPath") ?? "")

  if (
    !isGate(gate) ||
    returnPath === "/" ||
    mutationPath === "" ||
    !isAllowedMutationPath(gate, mutationPath)
  ) {
    return NextResponse.redirect(canonicalRedirect("/"), 303)
  }

  const fields = formFieldsFrom(form)
  delete fields.gate
  delete fields.returnPath
  delete fields.mutationPath

  const pending = {
    returnPath,
    mutationPath,
    gate,
    actionClass: actionClassForGate(gate),
    fields,
  }

  const jar = Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  )
  const outcome = readSession(jar)
  if (outcome.status !== "active") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const environment = readServerEnvironment()
  const issued = await issueSessionReauthentication(
    {
      baseUrl: environment.consoleApiBaseUrl,
      accessToken: outcome.session.accessToken,
      correlationId: crypto.randomUUID(),
    },
    {
      actionClass: pending.actionClass,
      idempotencyKey: crypto.randomUUID(),
    },
  )

  const response = await redirectForReauthentication(
    pending,
    outcome.session.providerSessionId,
    issued.ok ? undefined : issueFailureCode(issued),
  )
  response.headers.set("cache-control", NO_STORE)

  if (issued.ok) {
    await storeChallenge(response, {
      challengeId: issued.value.challengeId,
      actionClass: issued.value.actionClass,
      expiresAt: issued.value.expiresAt,
      providerSessionId: outcome.session.providerSessionId,
    })
  }

  return response
}

const isGate = (value: string): value is ReauthenticationGate =>
  value === "repository_import" ||
  value === "knowledge_lifecycle" ||
  value === "membership_change"
