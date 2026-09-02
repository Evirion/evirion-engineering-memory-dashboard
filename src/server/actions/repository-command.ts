import "server-only"

import { NextResponse, type NextRequest } from "next/server"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import type { ConsoleResult } from "@/server/adapters/console-api"
import { type RepositoryScope, isUuid } from "@/server/adapters/repositories"
import { canonicalRedirect } from "@/server/actions/redirects"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { fetchSessionContext } from "@/server/adapters/console-api"

/**
 * The one path a repository mutation takes.
 *
 * Order matters and is fixed: the origin, canonical host, Fetch Metadata,
 * content type, trusted proxy and session-bound CSRF proof are all settled
 * before anything is read from the form and before any effect exists. Only
 * then is the command forwarded, with the caller's own token, the canonical
 * idempotency key the form carried and the expected version the backend last
 * reported.
 *
 * Success is claimed only from a committed receipt. There is no optimistic
 * local authority over capacity, over a slot, or over a version.
 */

export type CommandFields = {
  readonly repositoryId: string
  readonly idempotencyKey: string
  readonly expectedVersion: number | null
  readonly form: FormData
}

export type CommandOutcome =
  | {
      readonly status: "ready"
      readonly scope: RepositoryScope
      readonly fields: CommandFields
    }
  | { readonly status: "rejected"; readonly response: NextResponse }

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

const back = (path: string, result: string): NextResponse => {
  const response = NextResponse.redirect(
    canonicalRedirect(`${path}?result=${encodeURIComponent(result)}`),
    303,
  )
  response.headers.set("cache-control", NO_STORE)
  return response
}

export const repositoryPath = (repositoryId: string): string =>
  isUuid(repositoryId) ? `/repositories/${repositoryId}` : "/repositories"

/**
 * Refuse before the backend is called.
 *
 * Only for input this surface can judge on its own, such as a confirmation the
 * contract fixes to `true`. It never fabricates a backend error envelope,
 * because a response the backend did not send is not evidence of anything.
 */
export const refuseRepositoryCommand = (
  repositoryId: string,
  code: "REQUEST_INVALID",
): NextResponse => back(repositoryPath(repositoryId), code)

/** A version the form carried but the backend never issued is not forwarded. */
const parseVersion = (raw: FormDataEntryValue | null): number | null | undefined => {
  if (raw === null || raw === "") return null
  if (typeof raw !== "string") return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : undefined
}

export const beginRepositoryCommand = async (
  request: NextRequest,
): Promise<CommandOutcome> => {
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
  const expectedVersion = parseVersion(form.get("expectedVersion"))

  if (
    !isUuid(repositoryId) ||
    !isUuid(idempotencyKey) ||
    expectedVersion === undefined
  ) {
    return {
      status: "rejected",
      response: back(repositoryPath(repositoryId), "REQUEST_INVALID"),
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
      response: back(repositoryPath(repositoryId), "DEPENDENCY_UNAVAILABLE"),
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
    fields: { repositoryId, idempotencyKey, expectedVersion, form },
  }
}

/**
 * Turn a command result into the next page.
 *
 * A published stable code travels back so the surface can explain the refusal.
 * Retryability deliberately does not: it belongs to the backend payload that
 * produced it, and a boolean re-derived on a later request would be the UI
 * asserting something no backend told it.
 */
export const finishRepositoryCommand = <T>(
  repositoryId: string,
  result: ConsoleResult<T>,
): NextResponse => {
  const path = repositoryPath(repositoryId)
  if (result.ok) return back(path, "applied")

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
