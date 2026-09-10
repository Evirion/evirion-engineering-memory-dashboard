import { NextResponse, type NextRequest } from "next/server"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { mapConsoleError } from "@/lib/errors/console-errors"
import {
  type ConsoleFailure,
  fetchSessionContext,
  newCorrelationId,
} from "@/server/adapters/console-api"
import { fetchRepositoryImport } from "@/server/adapters/imports"
import { isUuid } from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

const ABSENT = new Set(["REPOSITORY_IMPORT_NOT_FOUND", "RESOURCE_NOT_FOUND"])

const json = (status: number, body: unknown): NextResponse => {
  const response = NextResponse.json(body, { status })
  response.headers.set("cache-control", NO_STORE)
  return response
}

const fromFailure = (failure: ConsoleFailure): NextResponse => {
  if (failure.kind === "error") {
    const mapped = mapConsoleError(failure.error)
    if (mapped.treatment === "sign-in-required") {
      return json(401, { code: "AUTHENTICATION_REQUIRED" })
    }
    if (ABSENT.has(mapped.code)) return json(200, { absent: true })
    if (mapped.treatment === "not-permitted") return json(403, { code: mapped.code })
  }
  return json(503, { code: "DEPENDENCY_UNAVAILABLE" })
}

/**
 * The progress facts the import page is allowed to poll.
 *
 * It exists because a soft refresh of the page left discovering and extracting
 * labels on screen after the backend had already moved. The browser compares
 * this snapshot to what the server rendered and reloads only when they differ.
 * No identifier, name, cost, or authorization detail is included.
 */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const raw = request.nextUrl.searchParams.get("repositoryId")
  const repositoryId = raw !== null && isUuid(raw) ? raw : undefined
  if (repositoryId === undefined) return json(400, { code: "REQUEST_INVALID" })

  const outcome = readSession(
    Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
    ),
  )
  if (outcome.status !== "active") return json(401, { code: "AUTHENTICATION_REQUIRED" })

  const environment = readServerEnvironment()
  const correlationId = newCorrelationId()
  const context = await fetchSessionContext(environment.consoleApiBaseUrl, {
    accessToken: outcome.session.accessToken,
    correlationId,
  })
  if (!context.ok) return fromFailure(context.failure)

  const current = await fetchRepositoryImport(
    {
      baseUrl: environment.consoleApiBaseUrl,
      organizationId: context.value.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId,
    },
    repositoryId,
  )
  if (!current.ok) return fromFailure(current.failure)

  return json(200, {
    status: current.value.status,
    discovered: current.value.counts.discovered,
    completed: current.value.counts.completed,
    failed: current.value.counts.failed,
  })
}
