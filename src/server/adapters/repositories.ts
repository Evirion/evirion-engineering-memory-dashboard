import "server-only"

import {
  type CommandReceipt,
  type GithubInstallation,
  type GithubSetupIntent,
  type GithubSyncRun,
  type Repository,
  type RepositoryPage,
  isCommandReceipt,
  isGithubInstallation,
  isGithubSetupIntent,
  isGithubSyncRun,
  isRepository,
  isRepositoryPage,
} from "@contracts/console"

import {
  type ConsoleResult,
  type ConsoleTransport,
  callConsoleApi,
} from "./console-api"

/**
 * The repository, entitlement, policy and GitHub control-plane operations.
 *
 * The contract binds no operation to a payload schema: every success response
 * references the bare envelope, whose `data` carries no type. Pairing an
 * operation with a generated validator is therefore this module's convention,
 * and each wrapper names the validator it binds so the pairing is reviewable.
 *
 * Two transport rules the contract fixes and this module enforces:
 *
 * - the only declared headers are `Idempotency-Key` and `X-Correlation-ID`;
 * - `expectedVersion` is a required body field. Sending it as a header would
 *   be dropped by the backend and the optimistic check would never run.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Path identity is always a UUID, so no caller value can traverse a path. */
export const isUuid = (value: string): boolean => UUID.test(value)

const identifier = (value: string, label: string): string => {
  // Unreachable from a route: every page validates its parameter first and
  // renders the not-found state. Asserted here so the invariant is enforced
  // rather than remembered, because `encodeURIComponent` leaves `..` intact.
  if (!isUuid(value)) throw new Error(`${label} must be a UUID identifier`)
  return value
}

export type RepositoryScope = {
  readonly baseUrl: string
  readonly organizationId: string
  readonly accessToken: string
  readonly correlationId: string
}

export type RepositoryCommandTarget = {
  readonly repositoryId: string
  readonly idempotencyKey: string
}

/** Exactly the consent the contract accepts beside an `AUTO_EXTRACT` policy. */
export type LiveRepositoryConsent = {
  readonly scope: "LIVE_REPOSITORY"
  readonly allowedModelProfiles: readonly string[]
  readonly callCeiling: number
  readonly budgetCeilingUsd: string
  readonly retryPolicy: "NO_RETRY" | "BOUNDED_TRANSPORT_RETRY"
  readonly expiresAt: string
}

export type RepositoryPolicyMode = "OFF" | "SOURCE_ONLY" | "AUTO_EXTRACT"

const organizationPath = (scope: RepositoryScope, suffix: string): string =>
  `/v1/organizations/${identifier(scope.organizationId, "organization")}${suffix}`

const repositoryPath = (
  scope: RepositoryScope,
  repositoryId: string,
  suffix = "",
): string =>
  organizationPath(
    scope,
    `/repositories/${identifier(repositoryId, "repository")}${suffix}`,
  )

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

const command = (
  scope: RepositoryScope,
  input: {
    readonly method: "POST" | "PATCH"
    readonly path: string
    readonly idempotencyKey: string
    readonly body: unknown
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<CommandReceipt>> =>
  callConsoleApi<CommandReceipt>(
    scope.baseUrl,
    {
      method: input.method,
      path: input.path,
      accessToken: scope.accessToken,
      correlationId: scope.correlationId,
      idempotencyKey: identifier(input.idempotencyKey, "idempotency key"),
      body: input.body,
    },
    isCommandReceipt,
    transport,
  )

const bounded = (reason: string | undefined): { reason?: string } => {
  const trimmed = reason?.trim() ?? ""
  return trimmed === "" ? {} : { reason: trimmed.slice(0, 500) }
}

export const fetchRepositoryPage = (
  scope: RepositoryScope,
  page: { readonly pageSize?: number; readonly after?: string },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<RepositoryPage>> => {
  const query = new URLSearchParams()
  if (page.pageSize !== undefined) query.set("pageSize", String(page.pageSize))
  if (page.after !== undefined) {
    query.set("after", identifier(page.after, "cursor"))
  }
  const suffix = query.size === 0 ? "" : `?${query.toString()}`

  return read(
    scope,
    organizationPath(scope, `/repositories${suffix}`),
    isRepositoryPage,
    transport,
  )
}

export const fetchRepository = (
  scope: RepositoryScope,
  repositoryId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<Repository>> =>
  read(scope, repositoryPath(scope, repositoryId), isRepository, transport)

export const fetchGithubInstallation = (
  scope: RepositoryScope,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<GithubInstallation>> =>
  read(
    scope,
    organizationPath(scope, "/github/installation"),
    isGithubInstallation,
    transport,
  )

export const fetchGithubSyncRun = (
  scope: RepositoryScope,
  syncRunId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<GithubSyncRun>> =>
  read(
    scope,
    organizationPath(
      scope,
      `/github/sync-runs/${identifier(syncRunId, "synchronization run")}`,
    ),
    isGithubSyncRun,
    transport,
  )

export const startGithubInstallation = (
  scope: RepositoryScope,
  idempotencyKey: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<GithubSetupIntent>> =>
  callConsoleApi<GithubSetupIntent>(
    scope.baseUrl,
    {
      method: "POST",
      path: organizationPath(scope, "/github/installation-intents"),
      accessToken: scope.accessToken,
      correlationId: scope.correlationId,
      idempotencyKey: identifier(idempotencyKey, "idempotency key"),
      body: {},
    },
    isGithubSetupIntent,
    transport,
  )

export const startGithubRepositorySync = (
  scope: RepositoryScope,
  idempotencyKey: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<GithubSyncRun>> =>
  callConsoleApi<GithubSyncRun>(
    scope.baseUrl,
    {
      method: "POST",
      path: organizationPath(scope, "/github/sync-runs"),
      accessToken: scope.accessToken,
      correlationId: scope.correlationId,
      idempotencyKey: identifier(idempotencyKey, "idempotency key"),
      body: {},
    },
    isGithubSyncRun,
    transport,
  )

export const activateRepositoryEntitlement = (
  scope: RepositoryScope,
  input: RepositoryCommandTarget & {
    /** `null` is a first activation, where no entitlement row exists yet. */
    readonly expectedVersion: number | null
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<CommandReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: repositoryPath(scope, input.repositoryId, "/activate"),
      idempotencyKey: input.idempotencyKey,
      // The contract fixes this to `true`: the confirmation is the customer's,
      // and the backend refuses a request that does not carry it.
      body: { expectedVersion: input.expectedVersion, confirmationAccepted: true },
    },
    transport,
  )

export const disableRepositoryEntitlement = (
  scope: RepositoryScope,
  input: RepositoryCommandTarget & {
    readonly expectedVersion: number
    readonly reason?: string
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<CommandReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: repositoryPath(scope, input.repositoryId, "/disable"),
      idempotencyKey: input.idempotencyKey,
      body: { expectedVersion: input.expectedVersion, ...bounded(input.reason) },
    },
    transport,
  )

export const requestRepositoryEntitlementChange = (
  scope: RepositoryScope,
  input: RepositoryCommandTarget & {
    readonly requestedRepositoryId: string
    readonly expectedVersion: number
    readonly reason?: string
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<CommandReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: repositoryPath(scope, input.repositoryId, "/request-change"),
      idempotencyKey: input.idempotencyKey,
      body: {
        expectedVersion: input.expectedVersion,
        requestedRepositoryId: identifier(
          input.requestedRepositoryId,
          "requested repository",
        ),
        ...bounded(input.reason),
      },
    },
    transport,
  )

export const updateRepositoryProcessingPolicy = (
  scope: RepositoryScope,
  input: RepositoryCommandTarget & {
    readonly expectedVersion: number
    readonly mode: RepositoryPolicyMode
    /** Required, not optional: `null` is the explicit absence of consent. */
    readonly consent: LiveRepositoryConsent | null
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<CommandReceipt>> =>
  command(
    scope,
    {
      method: "PATCH",
      path: repositoryPath(scope, input.repositoryId, "/processing-policy"),
      idempotencyKey: input.idempotencyKey,
      body: {
        expectedVersion: input.expectedVersion,
        mode: input.mode,
        consent: input.consent,
      },
    },
    transport,
  )
