import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { MemoryFilters } from "@/components/memory/memory-filters"
import {
  MemoryQueueList,
  MemoryQueuePagination,
} from "@/components/memory/memory-queue"
import { readKnowledgeFilters } from "@/lib/knowledge/filters"
import { readKnowledgeQueue } from "@/server/queries/knowledge"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The Engineering Memory review queue.
 *
 * It lists admitted Knowledge Objects only. A machine `REJECTED` or
 * `QUARANTINED` extraction is a legitimate outcome that produced no knowledge,
 * so it is never a row here.
 *
 * The default view is the backend's own: an absent review-status predicate
 * means awaiting review. The Console does not supply that default, because
 * doing so would make it the authority on what the queue shows.
 */
const MemoryPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  // Anything the contract does not admit is dropped rather than forwarded, so
  // a crafted URL reads as the unfiltered queue instead of steering the path
  // the adapter builds or echoing crafted text back.
  const filters = readKnowledgeFilters(await searchParams)
  const view = await readKnowledgeQueue(filters)

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Engineering Memory</h1>
        <p className="text-sm text-slate-600">
          Human review and lifecycle are separate decisions. Reviewing a Knowledge
          Object does not make it active, and activating one does not close its review.
        </p>
      </div>

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
          <MemoryQueuePagination page={view.page} filters={view.filters} />
        </>
      )}
    </section>
  )
}

export default MemoryPage
