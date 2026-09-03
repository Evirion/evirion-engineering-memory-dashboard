import type { KnowledgeSummary } from "@contracts/console"

/**
 * The review-queue predicates, read from and written back to the URL.
 *
 * `MEM-002` requires the filter state to be shareable, so it lives in the
 * query string and nowhere else. Nothing here is a secret, an identifier the
 * caller could not already name, or an authorization input: the backend scopes
 * every predicate to the caller's organization regardless of what arrives.
 *
 * A value the contract does not admit is dropped rather than forwarded. A
 * crafted URL then reads as the unfiltered queue instead of producing a
 * refusal that echoes the crafted text back to the customer.
 */

export type ReviewStatus = Exclude<
  KnowledgeSummary["reviewStatus"],
  "UNSUPPORTED_SERVER_RESPONSE"
>
export type LifecycleState = Exclude<
  KnowledgeSummary["lifecycleState"],
  "UNSUPPORTED_SERVER_RESPONSE"
>

export const REVIEW_STATUSES: readonly ReviewStatus[] = [
  "PENDING",
  "APPROVED",
  "EDITED",
  "USER_REJECTED",
]

export const LIFECYCLE_STATES: readonly LifecycleState[] = [
  "UNRESOLVED",
  "ACTIVE",
  "SUPERSEDED",
  "WITHDRAWN",
]

export type KnowledgeFilters = {
  readonly repositoryId?: string
  readonly knowledgeType?: string
  readonly reviewStatus?: ReviewStatus
  readonly lifecycleState?: LifecycleState
  readonly pullRequestId?: string
  readonly authorLogin?: string
  readonly mergedFrom?: string
  readonly mergedTo?: string
  readonly after?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KNOWLEDGE_TYPE = /^[A-Za-z]{1,64}$/
const AUTHOR_LOGIN = /^[A-Za-z0-9._-]{1,64}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

/** One value from a search parameter that Next may hand over as an array. */
export type RawParam = string | string[] | undefined

const single = (value: RawParam): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === "string" && raw !== "" ? raw : undefined
}

const matching = (value: RawParam, pattern: RegExp): string | undefined => {
  const raw = single(value)
  return raw !== undefined && pattern.test(raw) ? raw : undefined
}

const oneOf = <T extends string>(
  value: RawParam,
  allowed: readonly T[],
): T | undefined => {
  const raw = single(value)
  return allowed.find((entry) => entry === raw)
}

const present = <T>(key: string, value: T | undefined): Record<string, T> =>
  value === undefined ? {} : { [key]: value }

export type SearchParams = Readonly<Record<string, RawParam>>

/**
 * Read the predicates the contract publishes and nothing else.
 *
 * An absent `reviewStatus` is deliberately left absent rather than defaulted
 * to `PENDING` here. The backend owns that default, and supplying it would
 * make the Console the authority on what the review queue shows.
 */
export const readKnowledgeFilters = (params: SearchParams): KnowledgeFilters => ({
  ...present("repositoryId", matching(params["repositoryId"], UUID)),
  ...present("knowledgeType", matching(params["knowledgeType"], KNOWLEDGE_TYPE)),
  ...present("reviewStatus", oneOf(params["reviewStatus"], REVIEW_STATUSES)),
  ...present("lifecycleState", oneOf(params["lifecycleState"], LIFECYCLE_STATES)),
  ...present("pullRequestId", matching(params["pullRequestId"], UUID)),
  ...present("authorLogin", matching(params["authorLogin"], AUTHOR_LOGIN)),
  ...present("mergedFrom", matching(params["mergedFrom"], DATE_TIME)),
  ...present("mergedTo", matching(params["mergedTo"], DATE_TIME)),
  ...present("after", matching(params["after"], UUID)),
})

/**
 * The shareable link for a filter set.
 *
 * The cursor is deliberately droppable: changing a predicate restarts the scan
 * rather than resuming someone else's page, which would silently skip rows.
 */
export const knowledgeQueryString = (
  filters: KnowledgeFilters,
  options: { readonly keepCursor?: boolean } = {},
): string => {
  const search = new URLSearchParams()
  const entries: readonly (readonly [string, string | undefined])[] = [
    ["repositoryId", filters.repositoryId],
    ["knowledgeType", filters.knowledgeType],
    ["reviewStatus", filters.reviewStatus],
    ["lifecycleState", filters.lifecycleState],
    ["pullRequestId", filters.pullRequestId],
    ["authorLogin", filters.authorLogin],
    ["mergedFrom", filters.mergedFrom],
    ["mergedTo", filters.mergedTo],
    ...(options.keepCursor === true
      ? ([["after", filters.after]] as const)
      : ([] as const)),
  ]

  for (const [key, value] of entries) {
    if (value !== undefined) search.set(key, value)
  }

  return search.size === 0 ? "" : `?${search.toString()}`
}

/**
 * The queue path for a filter set.
 *
 * A repository-scoped queue pins its repository in the path, so that predicate
 * is not repeated in the query string where a customer could edit it into a
 * different repository than the page they are on.
 */
export const knowledgeQueuePath = (
  filters: KnowledgeFilters,
  options: { readonly repositoryId?: string; readonly keepCursor?: boolean } = {},
): string => {
  if (options.repositoryId === undefined) {
    return `/memory${knowledgeQueryString(filters, options)}`
  }

  const { repositoryId: _pinned, ...rest } = filters
  return `/repositories/${options.repositoryId}/memory${knowledgeQueryString(rest, options)}`
}
