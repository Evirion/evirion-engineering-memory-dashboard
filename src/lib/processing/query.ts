/**
 * The processing list's shareable query.
 *
 * Filter, cursor and sort live in the URL so a view can be bookmarked. The
 * page size does not: PROC-001 requires pagination to be enforced, and a bound
 * the caller can choose is not a bound. `pageSize` in the query string is
 * ignored rather than forwarded. A malformed `repositoryId` or `after` is
 * forwarded so the read can refuse it, rather than silently becoming an
 * unfiltered first page.
 *
 * `sort` and `dir` are Console presentation. The published backend page is
 * ordered by extraction-job identity, and those two keys are never sent there.
 */

export const PROCESSING_PAGE_SIZE = 20

/** The largest page the processing-activity contract will accept. */
export const PROCESSING_BACKEND_PAGE_SIZE = 100

export const PROCESSING_SORTS = [
  "repository",
  "pullRequest",
  "outcome",
  "authorization",
  "job",
  "updated",
] as const

export const PROCESSING_DIRECTIONS = ["asc", "desc"] as const

export type ProcessingSort = (typeof PROCESSING_SORTS)[number]
export type ProcessingDirection = (typeof PROCESSING_DIRECTIONS)[number]

export type ProcessingViewQuery = {
  readonly repositoryId?: string
  readonly after?: string
  readonly sort?: ProcessingSort
  readonly dir?: ProcessingDirection
}

export type RawParam = string | string[] | undefined

const single = (value: RawParam): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === "string" && raw !== "" ? raw : undefined
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

export const readProcessingQuery = (params: SearchParams): ProcessingViewQuery => {
  const sort = oneOf(params["sort"], PROCESSING_SORTS)
  const dir = oneOf(params["dir"], PROCESSING_DIRECTIONS)

  return {
    ...present("repositoryId", single(params["repositoryId"])),
    ...present("after", single(params["after"])),
    ...(sort === undefined
      ? {}
      : { sort, dir: dir === undefined ? ("asc" as const) : dir }),
  }
}

export const processingQueryString = (
  query: ProcessingViewQuery,
  options: { readonly keepCursor?: boolean } = {},
): string => {
  const search = new URLSearchParams()
  const entries: readonly (readonly [string, string | undefined])[] = [
    ["repositoryId", query.repositoryId],
    ...(options.keepCursor === true ? ([["after", query.after]] as const) : []),
    ["sort", query.sort],
    ["dir", query.sort === undefined ? undefined : query.dir],
  ]

  for (const [key, value] of entries) {
    if (value !== undefined) search.set(key, value)
  }

  return search.size === 0 ? "" : `?${search.toString()}`
}

export const processingPath = (
  query: ProcessingViewQuery,
  options: { readonly keepCursor?: boolean } = {},
): string => `/processing${processingQueryString(query, options)}`

export const nextProcessingSort = (
  query: ProcessingViewQuery,
  column: ProcessingSort,
): Pick<ProcessingViewQuery, "sort" | "dir"> => {
  if (query.sort === column && query.dir === "asc") {
    return { sort: column, dir: "desc" }
  }
  return { sort: column, dir: "asc" }
}
