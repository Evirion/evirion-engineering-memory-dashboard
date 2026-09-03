import "server-only"

import {
  type RepositoryImport,
  type RepositoryImportFailures,
  type RepositoryImportReceipt,
  isRepositoryImport,
  isRepositoryImportFailures,
  isRepositoryImportReceipt,
} from "@contracts/console"

import {
  type ConsoleResult,
  type ConsoleTransport,
  callConsoleApi,
} from "./console-api"
import { type RepositoryScope, isUuid } from "./repositories"

/**
 * The six historical-import operations.
 *
 * They live beside the repository adapters rather than inside them because
 * they answer with a different receipt. Every entitlement and policy mutation
 * returns `CommandReceipt`, whose response codes the contract fixes to the four
 * entitlement ones; an import mutation returns `RepositoryImportReceipt`, whose
 * codes are its own and whose payload is the whole import projection.
 *
 * Three contract rules this module enforces:
 *
 * - the only declared headers are `Idempotency-Key` and `X-Correlation-ID`;
 * - approve and state carry `expectedStatus` rather than `expectedVersion`,
 *   because `core.backfill_runs` has no version column. A stale status
 *   conflicts exactly as a stale version does;
 * - the create body admits no mode field at all. The backend fixes customer
 *   imports to `MISSING_ONLY`, and `reextract` is operator-only, so there is
 *   nothing here for a caller to influence.
 */

export type RepositoryImportStatus = RepositoryImport["status"]
export type RepositoryImportState = "PAUSED" | "RESUMED" | "CANCELLED"

/** The bounded merge window. Omitting both bounds imports the whole history. */
export type RepositoryImportFilters = {
  readonly mergedFrom?: string
  readonly mergedTo?: string
}

export type ImportCommandTarget = {
  readonly importId: string
  readonly idempotencyKey: string
}

const identifier = (value: string, label: string): string => {
  // Unreachable from a route: every caller validates its parameter first.
  // Asserted here so the invariant is enforced rather than remembered, because
  // `encodeURIComponent` leaves `..` intact.
  if (!isUuid(value)) throw new Error(`${label} must be a UUID identifier`)
  return value
}

const organizationPath = (scope: RepositoryScope, suffix: string): string =>
  `/v1/organizations/${identifier(scope.organizationId, "organization")}${suffix}`

const importPath = (scope: RepositoryScope, importId: string, suffix = ""): string =>
  organizationPath(scope, `/imports/${identifier(importId, "import")}${suffix}`)

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
): Promise<ConsoleResult<RepositoryImportReceipt>> =>
  callConsoleApi<RepositoryImportReceipt>(
    scope.baseUrl,
    {
      method: input.method,
      path: input.path,
      accessToken: scope.accessToken,
      correlationId: scope.correlationId,
      idempotencyKey: identifier(input.idempotencyKey, "idempotency key"),
      body: input.body,
    },
    isRepositoryImportReceipt,
    transport,
  )

export const fetchRepositoryImport = (
  scope: RepositoryScope,
  repositoryId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<RepositoryImport>> =>
  read(
    scope,
    organizationPath(
      scope,
      `/repositories/${identifier(repositoryId, "repository")}/imports/current`,
    ),
    isRepositoryImport,
    transport,
  )

export const fetchRepositoryImportFailures = (
  scope: RepositoryScope,
  importId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<RepositoryImportFailures>> =>
  read(
    scope,
    importPath(scope, importId, "/failures"),
    isRepositoryImportFailures,
    transport,
  )

export const createRepositoryImport = (
  scope: RepositoryScope,
  input: {
    readonly repositoryId: string
    readonly idempotencyKey: string
    readonly filters: RepositoryImportFilters
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<RepositoryImportReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: organizationPath(
        scope,
        `/repositories/${identifier(input.repositoryId, "repository")}/imports`,
      ),
      idempotencyKey: input.idempotencyKey,
      // The contract fixes the confirmation to `true`: it is the customer's,
      // and the backend refuses a request that does not carry it. `filters` is
      // required even when it is empty, which is how the whole history is asked
      // for, so it is always sent rather than omitted.
      body: {
        confirmationAccepted: true,
        filters: {
          ...(input.filters.mergedFrom === undefined
            ? {}
            : { mergedFrom: input.filters.mergedFrom }),
          ...(input.filters.mergedTo === undefined
            ? {}
            : { mergedTo: input.filters.mergedTo }),
        },
      },
    },
    transport,
  )

export const approveRepositoryImport = (
  scope: RepositoryScope,
  input: ImportCommandTarget & {
    readonly expectedStatus: RepositoryImportStatus
    readonly costBudgetUsd: string
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<RepositoryImportReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: importPath(scope, input.importId, "/approve"),
      idempotencyKey: input.idempotencyKey,
      // Approving records the customer's consent to paid extraction. It does
      // not create Evirion operational authorization, which the customer
      // cannot grant, so the projection may still report a wait afterwards.
      body: {
        expectedStatus: input.expectedStatus,
        costBudgetUsd: input.costBudgetUsd,
        confirmationAccepted: true,
      },
    },
    transport,
  )

export const setRepositoryImportState = (
  scope: RepositoryScope,
  input: ImportCommandTarget & {
    readonly state: RepositoryImportState
    readonly expectedStatus: RepositoryImportStatus
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<RepositoryImportReceipt>> =>
  command(
    scope,
    {
      method: "PATCH",
      path: importPath(scope, input.importId, "/state"),
      idempotencyKey: input.idempotencyKey,
      // This is the one import body whose `confirmationAccepted` the contract
      // does not fix to `true`, so it is sent as the schema declares it rather
      // than normalised into the shape the other two use.
      body: {
        state: input.state,
        expectedStatus: input.expectedStatus,
        confirmationAccepted: true,
      },
    },
    transport,
  )

export const retryRepositoryImportJob = (
  scope: RepositoryScope,
  input: ImportCommandTarget & { readonly extractionJobId: string },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<RepositoryImportReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: importPath(
        scope,
        input.importId,
        `/failures/${identifier(input.extractionJobId, "extraction job")}/retry`,
      ),
      idempotencyKey: input.idempotencyKey,
      // The operation takes no body. Retryability is the backend's to declare
      // on the failure projection, so there is nothing for a caller to assert.
      body: undefined,
    },
    transport,
  )
