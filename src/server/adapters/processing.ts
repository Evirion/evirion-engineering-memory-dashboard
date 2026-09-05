import "server-only"

import {
  type ProcessingPage,
  type PullRequestDetail,
  type ValidationIssues,
  isProcessingPage,
  isPullRequestDetail,
  isValidationIssues,
} from "@contracts/console"

import {
  type ConsoleResult,
  type ConsoleTransport,
  callConsoleApi,
} from "./console-api"
import { type RepositoryScope, isUuid } from "./repositories"

const identifier = (value: string, label: string): string => {
  if (!isUuid(value)) throw new Error(`${label} must be a UUID identifier`)
  return value
}

const organizationPath = (scope: RepositoryScope, suffix: string): string =>
  `/v1/organizations/${identifier(scope.organizationId, "organization")}${suffix}`

const read = <T>(
  scope: RepositoryScope,
  path: string,
  isExpected: (value: unknown) => value is T,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<T>> =>
  callConsoleApi<T>(
    scope.baseUrl,
    {
      method: "GET",
      path,
      accessToken: scope.accessToken,
      correlationId: scope.correlationId,
    },
    isExpected,
    transport,
  )

export type ProcessingActivityQuery = {
  readonly pageSize?: number
  readonly after?: string
  readonly repositoryId?: string
}

export const fetchProcessingActivity = (
  scope: RepositoryScope,
  query: ProcessingActivityQuery = {},
  transport?: ConsoleTransport,
): Promise<ConsoleResult<ProcessingPage>> => {
  const search = new URLSearchParams()
  if (query.pageSize !== undefined) search.set("pageSize", String(query.pageSize))
  if (query.after !== undefined) {
    search.set("after", identifier(query.after, "cursor"))
  }
  if (query.repositoryId !== undefined) {
    search.set("repositoryId", identifier(query.repositoryId, "repository"))
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : ""
  return read(
    scope,
    organizationPath(scope, `/processing-activity${suffix}`),
    isProcessingPage,
    transport,
  )
}

export const fetchPullRequestDetail = (
  scope: RepositoryScope,
  pullRequestId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<PullRequestDetail>> =>
  read(
    scope,
    organizationPath(
      scope,
      `/pull-requests/${identifier(pullRequestId, "pull request")}`,
    ),
    isPullRequestDetail,
    transport,
  )

export const fetchValidationIssues = (
  scope: RepositoryScope,
  extractionRunId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<ValidationIssues>> =>
  read(
    scope,
    organizationPath(
      scope,
      `/extraction-runs/${identifier(extractionRunId, "extraction run")}/validation-issues`,
    ),
    isValidationIssues,
    transport,
  )
