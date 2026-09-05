import "server-only"

import { cookies } from "next/headers"

import type {
  ProcessingPage,
  PullRequestDetail,
  ValidationIssues,
} from "@contracts/console"

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
  type ProcessingActivityQuery,
  fetchProcessingActivity,
  fetchPullRequestDetail,
  fetchValidationIssues,
} from "@/server/adapters/processing"
import { type RepositoryScope, isUuid } from "@/server/adapters/repositories"
import { requireSessionContext } from "@/server/queries/session-context"

export type ProcessingActivityView =
  | {
      readonly status: "ready"
      readonly page: ProcessingPage
      readonly query: ProcessingActivityQuery
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

const correlationId = (): string => {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("hex")
}

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
      }
    }
    case "unsupported":
      return {
        code: UNKNOWN_ERROR.code,
        treatment: UNKNOWN_ERROR.treatment,
        message: describeTreatment(UNKNOWN_ERROR.treatment),
        retryable: UNKNOWN_ERROR.retryable,
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

const resolveScope = async (): Promise<
  { readonly ok: true; readonly scope: RepositoryScope } | { readonly ok: false }
> => {
  const context = await requireSessionContext()
  if (context.status === "unavailable") return { ok: false }

  const jar = await cookies()
  const outcome = readSession(
    Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])),
  )
  if (outcome.status !== "active") return { ok: false }

  const environment = readServerEnvironment()
  return {
    ok: true,
    scope: {
      baseUrl: environment.consoleApiBaseUrl,
      organizationId: context.context.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId: correlationId(),
    },
  }
}

export const readProcessingActivity = async (
  query: ProcessingActivityQuery = {},
): Promise<ProcessingActivityView> => {
  const resolved = await resolveScope()
  if (!resolved.ok) {
    return {
      status: "unavailable",
      failure: {
        code: "AUTHENTICATION_REQUIRED",
        treatment: "sign-in-required",
        message: describeTreatment("sign-in-required"),
        retryable: false,
      },
    }
  }

  if (query.repositoryId !== undefined && !isUuid(query.repositoryId)) {
    return {
      status: "unavailable",
      failure: {
        code: "REQUEST_INVALID",
        treatment: "not-permitted",
        message: describeTreatment("not-permitted"),
        retryable: false,
      },
    }
  }

  const result = await fetchProcessingActivity(resolved.scope, query)
  if (!result.ok) {
    return { status: "unavailable", failure: describeFailure(result.failure) }
  }

  return { status: "ready", page: result.value, query }
}

/**
 * Whether a quarantined run's issues could be read.
 *
 * A failed read and an empty list are different facts. Collapsing them would
 * let the one screen that exists to explain a quarantine say there was nothing
 * to explain.
 */
export type ValidationIssuesEntry =
  | { readonly status: "ready"; readonly issues: ValidationIssues }
  | { readonly status: "unavailable" }

export type PullRequestDetailView =
  | {
      readonly status: "ready"
      readonly detail: PullRequestDetail
      readonly validationIssues: Readonly<Record<string, ValidationIssuesEntry>>
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

const REFUSED: ViewFailure = {
  code: "RESOURCE_NOT_FOUND",
  treatment: "not-permitted",
  message: describeTreatment("not-permitted"),
  retryable: false,
}

/**
 * How far the number-to-identifier resolution will page.
 *
 * The frozen route addresses a pull request by its number and the contract
 * publishes no lookup by number, so the identifier is resolved from processing
 * activity. Reading one page would make every older pull request unreachable
 * and indistinguishable from one that does not exist, so the traversal is
 * bounded rather than absent, and exhausting the bound is reported as a
 * dependency failure rather than as a refusal.
 */
const CURSOR_PAGE_LIMIT = 20

type ResolvedPullRequest =
  | { readonly status: "found"; readonly pullRequestId: string }
  | { readonly status: "absent" }
  | { readonly status: "failed"; readonly failure: ViewFailure }

const resolvePullRequestId = async (
  scope: RepositoryScope,
  repositoryId: string,
  prNumber: number,
): Promise<ResolvedPullRequest> => {
  let after: string | undefined

  for (let visited = 0; visited < CURSOR_PAGE_LIMIT; visited += 1) {
    // Each request needs the cursor the previous one returned, so these cannot
    // be issued together. The loop stops on the first match, so the common case
    // is one request.
    // oxlint-disable-next-line no-await-in-loop
    const activity = await fetchProcessingActivity(scope, {
      repositoryId,
      ...(after === undefined ? {} : { after }),
    })
    if (!activity.ok) {
      return { status: "failed", failure: describeFailure(activity.failure) }
    }

    const row = activity.value.items.find(
      (entry) =>
        entry.pullRequestNumber === prNumber &&
        entry.repositoryId === repositoryId &&
        entry.pullRequestId !== undefined,
    )
    if (row?.pullRequestId !== undefined) {
      return { status: "found", pullRequestId: row.pullRequestId }
    }

    const nextCursor = activity.value.page.nextCursor
    if (nextCursor === null || nextCursor === after) return { status: "absent" }
    after = nextCursor
  }

  // The bound was reached with the pull request still unseen. Saying "not
  // found" here would assert an absence this read never established.
  return {
    status: "failed",
    failure: {
      code: "DEPENDENCY_UNAVAILABLE",
      treatment: "retry-bounded",
      message: describeTreatment("retry-bounded"),
      retryable: true,
    },
  }
}

export const readPullRequestDetail = async (
  repositoryId: string,
  prNumber: number,
): Promise<PullRequestDetailView> => {
  if (!isUuid(repositoryId) || !Number.isInteger(prNumber) || prNumber < 1) {
    return {
      status: "unavailable",
      failure: {
        code: "REQUEST_INVALID",
        treatment: "not-permitted",
        message: describeTreatment("not-permitted"),
        retryable: false,
      },
    }
  }

  const resolved = await resolveScope()
  if (!resolved.ok) {
    return {
      status: "unavailable",
      failure: {
        code: "AUTHENTICATION_REQUIRED",
        treatment: "sign-in-required",
        message: describeTreatment("sign-in-required"),
        retryable: false,
      },
    }
  }

  const located = await resolvePullRequestId(resolved.scope, repositoryId, prNumber)
  if (located.status === "failed") {
    return { status: "unavailable", failure: located.failure }
  }
  // A pull request in another tenant and one that does not exist answer
  // identically, or the answer itself discloses existence.
  if (located.status === "absent") {
    return { status: "unavailable", failure: REFUSED }
  }

  const detail = await fetchPullRequestDetail(resolved.scope, located.pullRequestId)
  if (!detail.ok) {
    return { status: "unavailable", failure: describeFailure(detail.failure) }
  }

  if (
    detail.value.repositoryId !== repositoryId ||
    detail.value.pullRequestNumber !== prNumber
  ) {
    return { status: "unavailable", failure: REFUSED }
  }

  const quarantinedRuns = detail.value.runs.filter(
    (run) => run.disposition === "QUARANTINED",
  )
  const validationEntries = await Promise.all(
    quarantinedRuns.map(async (run) => {
      const issues = await fetchValidationIssues(resolved.scope, run.extractionRunId)
      const entry: ValidationIssuesEntry = issues.ok
        ? { status: "ready", issues: issues.value }
        : { status: "unavailable" }
      return [run.extractionRunId, entry] as const
    }),
  )

  return {
    status: "ready",
    detail: detail.value,
    validationIssues: Object.fromEntries(validationEntries),
  }
}
