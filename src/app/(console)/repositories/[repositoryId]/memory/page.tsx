import { notFound } from "next/navigation"

import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { MemoryFilters } from "@/components/memory/memory-filters"
import {
  MemoryQueueList,
  MemoryQueuePagination,
} from "@/components/memory/memory-queue"
import { readKnowledgeFilters } from "@/lib/knowledge/filters"
import { readKnowledgeQueue } from "@/server/queries/knowledge"
import { validRepositoryId } from "@/server/queries/repositories"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * One repository's slice of the review queue.
 *
 * The repository is pinned by the path rather than by a query predicate, so it
 * cannot be edited into a different repository than the page the reviewer is
 * on. The repository read comes first and decides the tenant boundary: a
 * foreign identifier is refused there rather than by an empty list, which
 * would disclose nothing but would also claim the repository holds no
 * knowledge.
 */
const RepositoryMemoryPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ repositoryId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const { repositoryId } = await params
  const identifier = validRepositoryId(repositoryId)
  if (identifier === undefined) notFound()

  const filters = readKnowledgeFilters(await searchParams)
  const view = await readKnowledgeQueue(filters, identifier)

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {view.status === "ready" && view.repositoryName !== undefined
            ? `Engineering Memory for ${view.repositoryName}`
            : "Engineering Memory"}
        </h1>
        <p className="text-sm text-slate-600">
          Knowledge Objects extracted from this repository's merged pull requests.
        </p>
      </div>

      <nav aria-label="Repository sections">
        <a
          href={`/repositories/${identifier}`}
          className="text-sm text-slate-900 underline underline-offset-2"
        >
          Back to repository
        </a>
      </nav>

      {view.status === "unavailable" ? (
        <ConsoleUnavailable
          failure={view.failure}
          heading="The review queue is not available right now"
        />
      ) : (
        <>
          <MemoryFilters
            filters={view.filters}
            repositoryChoices={view.repositoryChoices}
          />
          <MemoryQueueList page={view.page} />
          <MemoryQueuePagination
            page={view.page}
            filters={view.filters}
            repositoryId={identifier}
          />
        </>
      )}
    </section>
  )
}

export default RepositoryMemoryPage
