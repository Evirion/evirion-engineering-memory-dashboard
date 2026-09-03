import "server-only"

import {
  type KnowledgeCorrections,
  type KnowledgeDetail,
  type KnowledgeEvidence,
  type KnowledgeLifecycleState,
  type KnowledgePage,
  type KnowledgeReceipt,
  type KnowledgeReviewHistory,
  type KnowledgeReviewState,
  type KnowledgeSummary,
  isKnowledgeCorrections,
  isKnowledgeDetail,
  isKnowledgeEvidence,
  isKnowledgeLifecycleState,
  isKnowledgePage,
  isKnowledgeReceipt,
  isKnowledgeReviewHistory,
  isKnowledgeReviewState,
} from "@contracts/console"

import {
  type ConsoleResult,
  type ConsoleTransport,
  callConsoleApi,
} from "./console-api"
import { type RepositoryScope, isUuid } from "./repositories"

/**
 * The eleven knowledge review and lifecycle operations.
 *
 * They live in their own module rather than beside the import adapters because
 * they answer with a third receipt. An entitlement mutation returns
 * `CommandReceipt`, an import mutation returns `RepositoryImportReceipt`, and
 * every knowledge mutation returns `KnowledgeReceipt`, whose four response
 * codes are its own and none of which is a published error code.
 *
 * Three contract rules this module enforces:
 *
 * - the optimistic tokens travel in the body, not as `expected-*-version`
 *   headers. `KnowledgeExpectedSequence` admits zero, because review sequence
 *   zero is `PENDING` and lifecycle version zero is `UNRESOLVED`, so this is
 *   deliberately not the `expectedVersion` shape a versioned resource uses;
 * - supersession carries four tokens, two per object. The path identifies the
 *   superseded object and `newKnowledgeObjectId` names the one replacing it;
 * - a correction of type `RETRACT_SUPERSESSION` is the only one carrying a
 *   relation identifier, and `expectedRelationVersion` accompanies it.
 *
 * Every token here comes from a backend projection and is forwarded unchanged.
 * Nothing in this module derives, defaults or increments one.
 *
 * All eleven are bound because the published surface is what this module is
 * for, and each one's URL and validator are pinned by its own test. Two are
 * not yet read by a page: `KnowledgeDetail` embeds both the review state and
 * the lifecycle state, so a screen that has the detail already has them and a
 * second round trip would only risk showing two halves taken a moment apart.
 */

export type KnowledgeReviewAction =
  "APPROVE" | "EDIT" | "USER_REJECT" | "REVERT_TO_ORIGINAL_AND_APPROVE"

export type KnowledgeRejectReasonCode =
  | "INCORRECT"
  | "NOT_DURABLE"
  | "UNSUPPORTED"
  | "TOO_VAGUE"
  | "DUPLICATE"
  | "OUTDATED"
  | "OTHER"

export type KnowledgeIssueSeverity = "NONE" | "MINOR" | "MAJOR" | "CRITICAL"

export type KnowledgeCorrectionRequestType =
  "RETRACT_SUPERSESSION" | "WITHDRAW_ACTIVE_KNOWLEDGE" | "RESTORE_UNRESOLVED"

export type KnowledgeCorrectionReasonCode =
  | "SUPERSESSION_ERRONEOUS"
  | "KNOWLEDGE_NO_LONGER_TRUE"
  | "KNOWLEDGE_MISATTRIBUTED"
  | "OTHER"

export type ReviewStatus = KnowledgeSummary["reviewStatus"]
export type LifecycleState = KnowledgeSummary["lifecycleState"]

/**
 * The complete editable projection.
 *
 * All thirteen keys are required because `REV-002` defines an edit as a full
 * reviewed derivative rather than a patch. Evidence, source, author, dates,
 * code anchors, model, admission and run identifiers, scoring, knowledge
 * status and every lifecycle or relation field are never editable and are
 * absent here by construction.
 */
export type KnowledgeEditPayload = {
  readonly knowledgeType: string
  readonly implementationStatus: string
  readonly problem: string
  readonly knowledge: string
  readonly designRationale: string
  readonly futureImpact: string
  readonly documentedTradeoffs: readonly string[]
  readonly explicitAlternatives: readonly string[]
  readonly constraints: readonly string[]
  readonly invariants: readonly string[]
  readonly failureModes: readonly string[]
  readonly affectedSystems: readonly string[]
  readonly answerableQuestions: readonly string[]
}

/** The observed pair every single-object mutation rechecks under the lock. */
export type KnowledgeExpectedPair = {
  readonly expectedReviewSequence: number
  readonly expectedLifecycleVersion: number
}

export type KnowledgeCommandTarget = {
  readonly knowledgeObjectId: string
  readonly idempotencyKey: string
}

/**
 * The queue predicates. Every one is optional, and an absent `reviewStatus` is
 * the backend's own `PENDING` default rather than a value this module supplies.
 */
export type KnowledgeQuery = {
  readonly pageSize?: number
  readonly after?: string
  readonly repositoryId?: string
  readonly knowledgeType?: string
  readonly reviewStatus?: ReviewStatus
  readonly lifecycleState?: LifecycleState
  readonly pullRequestId?: string
  readonly authorLogin?: string
  readonly mergedFrom?: string
  readonly mergedTo?: string
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

const knowledgePath = (
  scope: RepositoryScope,
  knowledgeObjectId: string,
  suffix = "",
): string =>
  organizationPath(
    scope,
    `/knowledge/${identifier(knowledgeObjectId, "knowledge object")}${suffix}`,
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
    readonly path: string
    readonly idempotencyKey: string
    readonly body: unknown
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeReceipt>> =>
  callConsoleApi<KnowledgeReceipt>(
    scope.baseUrl,
    {
      method: "POST",
      path: input.path,
      accessToken: scope.accessToken,
      correlationId: scope.correlationId,
      idempotencyKey: identifier(input.idempotencyKey, "idempotency key"),
      body: input.body,
    },
    isKnowledgeReceipt,
    transport,
  )

/**
 * A note the backend will accept, or nothing at all.
 *
 * `KnowledgeReviewNote` requires a `btrim`-stable string of at least one
 * character, so an empty or whitespace-only field is omitted rather than sent
 * as `""` and refused.
 */
const bounded = (note: string | undefined): { note?: string } => {
  const trimmed = note?.trim() ?? ""
  return trimmed === "" ? {} : { note: trimmed.slice(0, 2000) }
}

export const fetchKnowledgePage = (
  scope: RepositoryScope,
  query: KnowledgeQuery,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgePage>> => {
  const search = new URLSearchParams()
  if (query.pageSize !== undefined) search.set("pageSize", String(query.pageSize))
  if (query.after !== undefined) {
    search.set("after", identifier(query.after, "cursor"))
  }
  if (query.repositoryId !== undefined) {
    search.set("repositoryId", identifier(query.repositoryId, "repository"))
  }
  if (query.pullRequestId !== undefined) {
    search.set("pullRequestId", identifier(query.pullRequestId, "pull request"))
  }
  if (query.knowledgeType !== undefined)
    search.set("knowledgeType", query.knowledgeType)
  if (query.reviewStatus !== undefined) search.set("reviewStatus", query.reviewStatus)
  if (query.lifecycleState !== undefined) {
    search.set("lifecycleState", query.lifecycleState)
  }
  if (query.authorLogin !== undefined) search.set("authorLogin", query.authorLogin)
  if (query.mergedFrom !== undefined) search.set("mergedFrom", query.mergedFrom)
  if (query.mergedTo !== undefined) search.set("mergedTo", query.mergedTo)

  const suffix = search.size === 0 ? "" : `?${search.toString()}`
  return read(
    scope,
    organizationPath(scope, `/knowledge${suffix}`),
    isKnowledgePage,
    transport,
  )
}

export const fetchKnowledgeDetail = (
  scope: RepositoryScope,
  knowledgeObjectId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeDetail>> =>
  read(scope, knowledgePath(scope, knowledgeObjectId), isKnowledgeDetail, transport)

export const fetchKnowledgeEvidence = (
  scope: RepositoryScope,
  knowledgeObjectId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeEvidence>> =>
  read(
    scope,
    knowledgePath(scope, knowledgeObjectId, "/evidence"),
    isKnowledgeEvidence,
    transport,
  )

export const fetchKnowledgeReviewHistory = (
  scope: RepositoryScope,
  knowledgeObjectId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeReviewHistory>> =>
  read(
    scope,
    knowledgePath(scope, knowledgeObjectId, "/reviews"),
    isKnowledgeReviewHistory,
    transport,
  )

export const fetchKnowledgeReviewState = (
  scope: RepositoryScope,
  knowledgeObjectId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeReviewState>> =>
  read(
    scope,
    knowledgePath(scope, knowledgeObjectId, "/review-state"),
    isKnowledgeReviewState,
    transport,
  )

export const fetchKnowledgeLifecycleState = (
  scope: RepositoryScope,
  knowledgeObjectId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeLifecycleState>> =>
  read(
    scope,
    knowledgePath(scope, knowledgeObjectId, "/lifecycle-state"),
    isKnowledgeLifecycleState,
    transport,
  )

export const fetchKnowledgeCorrections = (
  scope: RepositoryScope,
  knowledgeObjectId: string,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeCorrections>> =>
  read(
    scope,
    knowledgePath(scope, knowledgeObjectId, "/corrections"),
    isKnowledgeCorrections,
    transport,
  )

/**
 * Record one immutable review decision.
 *
 * The backend owns which fields each action admits: `edit` belongs to `EDIT`
 * alone, `rejectReasonCode` to `USER_REJECT` alone, and both of those actions
 * require a severity. This module sends only what the caller supplied, so an
 * invalid combination is refused with a stable identifier rather than being
 * silently repaired into a different decision than the reviewer made.
 */
export const recordKnowledgeReview = (
  scope: RepositoryScope,
  input: KnowledgeCommandTarget &
    KnowledgeExpectedPair & {
      readonly action: KnowledgeReviewAction
      readonly edit?: KnowledgeEditPayload
      readonly rejectReasonCode?: KnowledgeRejectReasonCode
      readonly issueSeverity?: KnowledgeIssueSeverity
      readonly note?: string
      readonly acknowledgedEvidenceIds?: readonly string[]
    },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeReceipt>> =>
  command(
    scope,
    {
      path: knowledgePath(scope, input.knowledgeObjectId, "/reviews"),
      idempotencyKey: input.idempotencyKey,
      body: {
        action: input.action,
        expectedReviewSequence: input.expectedReviewSequence,
        expectedLifecycleVersion: input.expectedLifecycleVersion,
        ...(input.edit === undefined
          ? {}
          : { edit: { schemaVersion: "1", payload: input.edit } }),
        ...(input.rejectReasonCode === undefined
          ? {}
          : { rejectReasonCode: input.rejectReasonCode }),
        ...(input.issueSeverity === undefined
          ? {}
          : { issueSeverity: input.issueSeverity }),
        ...bounded(input.note),
        ...(input.acknowledgedEvidenceIds === undefined
          ? {}
          : {
              acknowledgedEvidenceIds: input.acknowledgedEvidenceIds.map((value) =>
                identifier(value, "evidence"),
              ),
            }),
      },
    },
    transport,
  )

export const markKnowledgeActive = (
  scope: RepositoryScope,
  input: KnowledgeCommandTarget & KnowledgeExpectedPair & { readonly note?: string },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeReceipt>> =>
  command(
    scope,
    {
      path: knowledgePath(scope, input.knowledgeObjectId, "/activate"),
      idempotencyKey: input.idempotencyKey,
      body: {
        expectedReviewSequence: input.expectedReviewSequence,
        expectedLifecycleVersion: input.expectedLifecycleVersion,
        ...bounded(input.note),
      },
    },
    transport,
  )

/**
 * Record that a newer Knowledge Object supersedes this one.
 *
 * The path names the old object and `newKnowledgeObjectId` the new one, so the
 * relation direction the backend stores is `new SUPERSEDES old`. All four
 * tokens are rechecked under the locks and each can go stale on its own.
 */
export const markKnowledgeSuperseded = (
  scope: RepositoryScope,
  input: KnowledgeCommandTarget & {
    readonly newKnowledgeObjectId: string
    readonly expectedNewReviewSequence: number
    readonly expectedNewLifecycleVersion: number
    readonly expectedOldReviewSequence: number
    readonly expectedOldLifecycleVersion: number
    readonly note?: string
  },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeReceipt>> =>
  command(
    scope,
    {
      path: knowledgePath(scope, input.knowledgeObjectId, "/supersede"),
      idempotencyKey: input.idempotencyKey,
      body: {
        newKnowledgeObjectId: identifier(
          input.newKnowledgeObjectId,
          "new knowledge object",
        ),
        expectedNewReviewSequence: input.expectedNewReviewSequence,
        expectedNewLifecycleVersion: input.expectedNewLifecycleVersion,
        expectedOldReviewSequence: input.expectedOldReviewSequence,
        expectedOldLifecycleVersion: input.expectedOldLifecycleVersion,
        ...bounded(input.note),
      },
    },
    transport,
  )

/**
 * Ask an operator to correct a lifecycle outcome.
 *
 * The customer creates and reads a request. Executing, rejecting and retrying
 * one are operator commands on a separate non-browser surface, so nothing here
 * can drive a request past `REQUESTED`.
 */
export const requestKnowledgeCorrection = (
  scope: RepositoryScope,
  input: KnowledgeCommandTarget &
    KnowledgeExpectedPair & {
      readonly requestType: KnowledgeCorrectionRequestType
      readonly reasonCode: KnowledgeCorrectionReasonCode
      readonly knowledgeRelationId?: string
      readonly expectedRelationVersion?: number
      readonly note?: string
    },
  transport?: ConsoleTransport,
): Promise<ConsoleResult<KnowledgeReceipt>> =>
  command(
    scope,
    {
      path: knowledgePath(scope, input.knowledgeObjectId, "/corrections"),
      idempotencyKey: input.idempotencyKey,
      body: {
        requestType: input.requestType,
        reasonCode: input.reasonCode,
        expectedReviewSequence: input.expectedReviewSequence,
        expectedLifecycleVersion: input.expectedLifecycleVersion,
        ...(input.knowledgeRelationId === undefined
          ? {}
          : {
              knowledgeRelationId: identifier(input.knowledgeRelationId, "relation"),
            }),
        ...(input.expectedRelationVersion === undefined
          ? {}
          : { expectedRelationVersion: input.expectedRelationVersion }),
        ...bounded(input.note),
      },
    },
    transport,
  )
