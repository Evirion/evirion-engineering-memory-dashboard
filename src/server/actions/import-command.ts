import "server-only"

import { NextResponse, type NextRequest } from "next/server"

import type { RepositoryImportReceipt } from "@contracts/console"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import type { ConsoleResult } from "@/server/adapters/console-api"
import { fetchSessionContext } from "@/server/adapters/console-api"
import type { RepositoryImportStatus } from "@/server/adapters/imports"
import { type RepositoryScope, isUuid } from "@/server/adapters/repositories"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"

/**
 * The one path an import mutation takes.
 *
 * It is the repository command path applied to a different resource, and it
 * deliberately keeps the same order: origin, canonical host, Fetch Metadata,
 * content type, trusted proxy and session-bound CSRF proof are all settled by
 * `guardMutation` before anything is read from the form and before any effect
 * exists. Only then is the command forwarded, with the caller's own token, the
 * canonical idempotency key the form carried and the status the backend last
 * reported.
 *
 * It is a separate module rather than a parameter on the repository one
 * because the two resources disagree on what optimistic concurrency is:
 * an entitlement carries a version, an import carries its status.
 *
 * Success is claimed only from a committed receipt.
 */

export const IMPORT_STATUSES: readonly RepositoryImportStatus[] = [
  "PLANNING",
  "DISCOVERING",
  "AWAITING_APPROVAL",
  "PROCESSING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]

export type ImportCommandFields = {
  readonly repositoryId: string
  readonly idempotencyKey: string
  readonly form: FormData
}

export type ImportCommandOutcome =
  | {
      readonly status: "ready"
      readonly scope: RepositoryScope
      readonly fields: ImportCommandFields
    }
  | { readonly status: "rejected"; readonly response: NextResponse }

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

/**
 * Typed against the receipt rather than written as a bare string, so a contract
 * that renames or drops this response code fails the typecheck instead of
 * silently sending every blocked resume home as a plain success again.
 */
const RESUME_BLOCKED: RepositoryImportReceipt["responseCode"] =
  "REPOSITORY_IMPORT_RESUME_BLOCKED"

const back = (path: string, result: string): NextResponse => {
  const response = NextResponse.redirect(
    canonicalRedirect(`${path}?result=${encodeURIComponent(result)}`),
    303,
  )
  response.headers.set("cache-control", NO_STORE)
  return response
}

export const importPath = (repositoryId: string): string =>
  isUuid(repositoryId) ? `/repositories/${repositoryId}/import` : "/repositories"

/**
 * Refuse before the backend is called.
 *
 * Only for input this surface can judge on its own, such as a range whose
 * bounds are the wrong way round. It never fabricates a backend error
 * envelope, because a response the backend did not send is not evidence.
 */
export const refuseImportCommand = (
  repositoryId: string,
  code: "REQUEST_INVALID",
): NextResponse => back(importPath(repositoryId), code)

/** The optimistic token is a published status, never anything the UI invents. */
export const readExpectedStatus = (
  form: FormData,
): RepositoryImportStatus | undefined => {
  const raw = String(form.get("expectedStatus") ?? "")
  return IMPORT_STATUSES.find((status) => status === raw)
}

export const readImportId = (form: FormData): string | undefined => {
  const raw = String(form.get("importId") ?? "")
  return isUuid(raw) ? raw : undefined
}

export const beginImportCommand = async (
  request: NextRequest,
): Promise<ImportCommandOutcome> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    // Origin, Fetch Metadata, content type, proxy or CSRF failed. No form
    // field has been read and no effect exists.
    return {
      status: "rejected",
      response: NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303),
    }
  }

  const form = guard.form
  const repositoryId = String(form.get("repositoryId") ?? "")
  const idempotencyKey = String(form.get("idempotencyKey") ?? "")

  // Refused before any backend call, so a malformed identifier costs nothing
  // and reaches nothing.
  if (!isUuid(repositoryId) || !isUuid(idempotencyKey)) {
    return {
      status: "rejected",
      response: back(importPath(repositoryId), "REQUEST_INVALID"),
    }
  }

  const jar = request.cookies.getAll()
  const outcome = readSession(Object.fromEntries(jar.map((c) => [c.name, c.value])))
  if (outcome.status !== "active") {
    return {
      status: "rejected",
      response: NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303),
    }
  }

  const environment = readServerEnvironment()
  const correlationId = crypto.randomUUID()

  // The organization is the backend's live projection for this token. A
  // caller-supplied organization is never an authorization source.
  const context = await fetchSessionContext(environment.consoleApiBaseUrl, {
    accessToken: outcome.session.accessToken,
    correlationId,
  })
  if (!context.ok) {
    return {
      status: "rejected",
      response: back(importPath(repositoryId), "DEPENDENCY_UNAVAILABLE"),
    }
  }

  return {
    status: "ready",
    scope: {
      baseUrl: environment.consoleApiBaseUrl,
      organizationId: context.value.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId,
    },
    fields: { repositoryId, idempotencyKey, form },
  }
}

/**
 * Turn a command result into the next page.
 *
 * A published stable code travels back so the surface can explain the refusal.
 * Retryability deliberately does not: it belongs to the backend payload that
 * produced it, and a boolean re-derived on a later request would be the UI
 * asserting something no backend told it.
 *
 * A resume the backend forced back to `PAUSED` is a completed command with its
 * own response code, not a failure, so it travels back as itself rather than
 * as a generic success.
 */
export const finishImportCommand = (
  repositoryId: string,
  result: ConsoleResult<RepositoryImportReceipt>,
): NextResponse => {
  const path = importPath(repositoryId)
  if (result.ok) {
    return back(
      path,
      result.value.responseCode === RESUME_BLOCKED ? RESUME_BLOCKED : "applied",
    )
  }

  switch (result.failure.kind) {
    case "error":
      return back(path, result.failure.error.error.code)
    case "unsupported":
      return back(path, "UNSUPPORTED_SERVER_RESPONSE")
    case "unreachable":
      return back(path, "DEPENDENCY_UNAVAILABLE")
    default: {
      const exhaustive: never = result.failure
      throw new Error(`unhandled console failure: ${JSON.stringify(exhaustive)}`)
    }
  }
}
