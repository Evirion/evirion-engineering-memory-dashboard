import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import type { GithubInstallation, Repository, RepositoryPage } from "@contracts/console"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import {
  type ViewFailure,
  UNKNOWN_ERROR,
  describeTreatment,
  mapConsoleError,
} from "@/lib/errors/console-errors"
import type { ConsoleFailure } from "@/server/adapters/console-api"
import {
  type RepositoryScope,
  fetchGithubInstallation,
  fetchRepository,
  fetchRepositoryPage,
  isUuid,
} from "@/server/adapters/repositories"
import { requireSessionContext } from "@/server/queries/session-context"

/**
 * Repository reads for a server-rendered page.
 *
 * The caller token is resolved and spent inside this module and never reaches
 * a page or a component, so no render path can put it in the document. Pages
 * receive a view model and nothing else.
 */

export type RepositoryListView =
  | {
      readonly status: "ready"
      readonly page: RepositoryPage
      readonly capabilities: readonly string[]
      readonly installation: GithubInstallation | null
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

export type RepositoryDetailView =
  | {
      readonly status: "ready"
      readonly repository: Repository
      readonly summary: RepositoryPage["summary"]
      readonly capabilities: readonly string[]
      /** Repositories a change request could name, from the backend list. */
      readonly candidates: readonly Repository[]
      /** True when the backend has more repositories than one page carries. */
      readonly candidatesTruncated: boolean
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

const correlationId = (): string => {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("hex")
}

/** An unrecognised document is an explicit unknown state, never a partial one. */
export const describeFailure = (
  failure: ConsoleFailure,
  requestId?: string,
): ViewFailure => {
  switch (failure.kind) {
    case "error": {
      const mapped = mapConsoleError(failure.error)
      return {
        code: mapped.code,
        treatment: mapped.treatment,
        message: describeTreatment(mapped.treatment),
        retryable: mapped.retryable,
        ...(mapped.requestId === undefined ? {} : { requestId: mapped.requestId }),
        ...(mapped.currentVersion === undefined
          ? {}
          : { currentVersion: mapped.currentVersion }),
      }
    }
    case "unsupported":
      return {
        code: UNKNOWN_ERROR.code,
        treatment: UNKNOWN_ERROR.treatment,
        message: describeTreatment(UNKNOWN_ERROR.treatment),
        retryable: false,
        ...(requestId === undefined ? {} : { requestId }),
      }
    case "unreachable":
      return {
        code: "DEPENDENCY_UNAVAILABLE",
        treatment: "retry-bounded",
        message: describeTreatment("retry-bounded"),
        retryable: true,
      }
    default: {
      const exhaustive: never = failure
      throw new Error(`unhandled console failure: ${JSON.stringify(exhaustive)}`)
    }
  }
}

type ResolvedScope =
  | {
      readonly status: "ready"
      readonly scope: RepositoryScope
      readonly capabilities: readonly string[]
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

const resolveScope = async (): Promise<ResolvedScope> => {
  const context = await requireSessionContext()
  if (context.status === "unavailable") {
    return {
      status: "unavailable",
      failure: {
        code: UNKNOWN_ERROR.code,
        treatment: "retry-bounded",
        message: context.message,
        retryable: true,
      },
    }
  }

  const jar = await cookies()
  const outcome = readSession(
    Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])),
  )
  if (outcome.status !== "active") redirect("/auth/sign-in")

  return {
    status: "ready",
    capabilities: context.context.capabilities,
    scope: {
      baseUrl: readServerEnvironment().consoleApiBaseUrl,
      organizationId: context.context.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId: correlationId(),
    },
  }
}

export const readRepositoryList = async (
  after?: string,
): Promise<RepositoryListView> => {
  const resolved = await resolveScope()
  if (resolved.status === "unavailable") return resolved

  const page = await fetchRepositoryPage(
    resolved.scope,
    after === undefined ? {} : { after },
  )
  if (!page.ok) return { status: "unavailable", failure: describeFailure(page.failure) }

  // The installation banner is a precondition of the list, not a separate
  // journey. A caller without the GitHub capability simply does not get one.
  const installation = await fetchGithubInstallation(resolved.scope)

  return {
    status: "ready",
    page: page.value,
    capabilities: resolved.capabilities,
    installation: installation.ok ? installation.value : null,
  }
}

export const readRepositoryDetail = async (
  repositoryId: string,
): Promise<RepositoryDetailView> => {
  const resolved = await resolveScope()
  if (resolved.status === "unavailable") return resolved

  const repository = await fetchRepository(resolved.scope, repositoryId)
  if (!repository.ok) {
    return { status: "unavailable", failure: describeFailure(repository.failure) }
  }

  // The capacity and replacement mode live on the list summary, and the
  // detail page needs them to know which entitlement control is even offered.
  // The contract maximum is requested because the same response supplies the
  // change-request candidates; walking every cursor to render one page would
  // be an unbounded read, so a remaining cursor is disclosed instead.
  const page = await fetchRepositoryPage(resolved.scope, { pageSize: 100 })
  if (!page.ok) return { status: "unavailable", failure: describeFailure(page.failure) }

  return {
    status: "ready",
    repository: repository.value,
    summary: page.value.summary,
    capabilities: resolved.capabilities,
    candidates: page.value.items.filter(
      (candidate) =>
        candidate.id !== repository.value.id &&
        candidate.accessible &&
        !candidate.archived &&
        candidate.entitlement === null,
    ),
    candidatesTruncated: page.value.page.nextCursor !== null,
  }
}

/** A route parameter that is not a UUID is refused before any backend call. */
export const validRepositoryId = (value: string | undefined): string | undefined =>
  value !== undefined && isUuid(value) ? value : undefined
