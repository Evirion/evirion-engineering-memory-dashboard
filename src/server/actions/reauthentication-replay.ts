import "server-only"

import { NextRequest, type NextResponse } from "next/server"

import { isAllowedMutationPath } from "@/lib/auth/reauthentication-action-class"
import type { PendingMutation } from "@/lib/auth/reauthentication-state"
import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import {
  issueSessionCsrfToken,
  SESSION_CSRF_COOKIE,
} from "@/server/actions/session-csrf"

type MutationHandler = (request: NextRequest) => Promise<NextResponse>

/**
 * Resolve a gated mutation handler in-process.
 *
 * Dynamic import breaks the route ↔ resume cycle without weakening the allowlist
 * that `isAllowedMutationPath` enforces before replay is attempted.
 */
const resolveMutationHandler = async (
  mutationPath: PendingMutation["mutationPath"],
): Promise<MutationHandler | undefined> => {
  switch (mutationPath) {
    case "/api/imports/prepare":
      return (await import("@/app/api/imports/prepare/route")).POST
    case "/api/imports/approve":
      return (await import("@/app/api/imports/approve/route")).POST
    case "/api/imports/state":
      return (await import("@/app/api/imports/state/route")).POST
    case "/api/imports/retry":
      return (await import("@/app/api/imports/retry/route")).POST
    case "/api/memory/activate":
      return (await import("@/app/api/memory/activate/route")).POST
    case "/api/memory/supersede":
      return (await import("@/app/api/memory/supersede/route")).POST
    case "/api/memory/corrections":
      return (await import("@/app/api/memory/corrections/route")).POST
    default:
      return undefined
  }
}

/** Replay the paused mutation in-process with a fresh CSRF proof for the live session. */
export const replayPendingMutation = async (
  request: NextRequest,
  pending: PendingMutation,
): Promise<NextResponse> => {
  if (!isAllowedMutationPath(pending.gate, pending.mutationPath)) {
    throw new Error(`replay path is not allowlisted: ${pending.mutationPath}`)
  }

  const handler = await resolveMutationHandler(pending.mutationPath)
  if (handler === undefined) {
    throw new Error(`unsupported replay path: ${pending.mutationPath}`)
  }

  const environment = readServerEnvironment()
  const jar = Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  )
  const outcome = readSession(jar)
  if (outcome.status !== "active") {
    throw new Error("replay requires an active session")
  }

  const csrfToken = await issueSessionCsrfToken(outcome.session.providerSessionId)
  jar[SESSION_CSRF_COOKIE] = csrfToken
  const fields = { ...pending.fields, csrfToken }

  const canonical = new URL(environment.canonicalOrigin)
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
    origin: environment.canonicalOrigin,
    host: canonical.host,
    "x-forwarded-proto": "https",
    "x-forwarded-host": canonical.host,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "navigate",
    cookie: Object.entries(jar)
      .filter(([, value]) => value !== "")
      .map(([name, value]) => `${name}=${value}`)
      .join("; "),
  })

  const replayRequest = new NextRequest(
    new URL(pending.mutationPath, environment.canonicalOrigin),
    {
      method: "POST",
      headers,
      body: new URLSearchParams(fields).toString(),
    },
  )

  return handler(replayRequest)
}
