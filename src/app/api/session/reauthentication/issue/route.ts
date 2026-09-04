import { NextResponse, type NextRequest } from "next/server"

import {
  actionClassForGate,
  type ReauthenticationGate,
} from "@/lib/auth/reauthentication-action-class"
import { normalizeReturnPath } from "@/lib/auth/reauthentication-return-path"
import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"
import {
  readPendingFromRequest,
  reauthenticationResumePath,
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
 * Issue a one-time step-up challenge for the pending gated mutation.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const pending = await readPendingFromRequest(request)
  const gate = guard.form.get("gate")
  const submittedReturnPath = guard.form.get("returnPath")

  if (pending === undefined && (typeof gate !== "string" || !isGate(gate))) {
    return NextResponse.redirect(canonicalRedirect("/"), 303)
  }

  const jar = Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  )
  const outcome = readSession(jar)
  if (outcome.status !== "active") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const actionClass =
    pending?.actionClass ?? actionClassForGate(gate as ReauthenticationGate)
  const returnPath =
    pending?.returnPath ??
    normalizeReturnPath(
      typeof submittedReturnPath === "string" ? submittedReturnPath : "/",
    )

  const environment = readServerEnvironment()
  const issued = await issueSessionReauthentication(
    {
      baseUrl: environment.consoleApiBaseUrl,
      accessToken: outcome.session.accessToken,
      correlationId: crypto.randomUUID(),
    },
    {
      actionClass,
      idempotencyKey: crypto.randomUUID(),
    },
  )

  let path = reauthenticationResumePath(returnPath)
  if (!issued.ok) {
    const url = new URL(path, "https://console.local")
    url.searchParams.set("result", issueFailureCode(issued))
    path = `${url.pathname}${url.search}`
  }

  const response = NextResponse.redirect(canonicalRedirect(path), 303)
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
