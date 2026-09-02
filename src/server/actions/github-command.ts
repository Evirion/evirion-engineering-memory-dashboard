import "server-only"

import { NextResponse, type NextRequest } from "next/server"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { canonicalRedirect } from "@/server/actions/redirects"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { fetchSessionContext } from "@/server/adapters/console-api"
import { type RepositoryScope, isUuid } from "@/server/adapters/repositories"

/**
 * The shared entry for the two GitHub control-plane commands.
 *
 * Both are organization-scoped rather than repository-scoped, so they share the
 * guard and the scope resolution but not the repository command's fields.
 */

export type GithubCommand =
  | {
      readonly status: "ready"
      readonly scope: RepositoryScope
      readonly idempotencyKey: string
    }
  | { readonly status: "rejected"; readonly response: NextResponse }

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

export const backToRepositories = (result: string): NextResponse => {
  const response = NextResponse.redirect(
    canonicalRedirect(`/repositories?result=${encodeURIComponent(result)}`),
    303,
  )
  response.headers.set("cache-control", NO_STORE)
  return response
}

export const beginGithubCommand = async (
  request: NextRequest,
): Promise<GithubCommand> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return {
      status: "rejected",
      response: NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303),
    }
  }

  const idempotencyKey = String(guard.form.get("idempotencyKey") ?? "")
  if (!isUuid(idempotencyKey)) {
    return { status: "rejected", response: backToRepositories("REQUEST_INVALID") }
  }

  const outcome = readSession(
    Object.fromEntries(request.cookies.getAll().map((c) => [c.name, c.value])),
  )
  if (outcome.status !== "active") {
    return {
      status: "rejected",
      response: NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303),
    }
  }

  const environment = readServerEnvironment()
  const correlationId = crypto.randomUUID()
  const context = await fetchSessionContext(environment.consoleApiBaseUrl, {
    accessToken: outcome.session.accessToken,
    correlationId,
  })
  if (!context.ok) {
    return {
      status: "rejected",
      response: backToRepositories("DEPENDENCY_UNAVAILABLE"),
    }
  }

  return {
    status: "ready",
    idempotencyKey,
    scope: {
      baseUrl: environment.consoleApiBaseUrl,
      organizationId: context.value.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId,
    },
  }
}
