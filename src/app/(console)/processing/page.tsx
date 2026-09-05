import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { ProcessingActivityTable } from "@/components/processing/processing-activity-table"
import { ProcessingFilters } from "@/components/processing/processing-filters"
import { ProcessingPoll } from "@/components/processing/processing-poll"
import { isProgressing } from "@/lib/processing/presentation"
import type { ProcessingActivityQuery } from "@/server/adapters/processing"
import { readProcessingActivity } from "@/server/queries/processing"
import { readRepositoryList } from "@/server/queries/repositories"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const readRepositoryFilter = (
  value: string | string[] | undefined,
): string | undefined => {
  if (typeof value !== "string" || value.length === 0) return undefined
  return value
}

/**
 * Processing Activity is read-only. No retry, resume, or backend-declared recovery
 * action exists on a live extraction job.
 */
const ProcessingPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const params = await searchParams
  const repositoryId = readRepositoryFilter(params.repositoryId)
  const query: ProcessingActivityQuery =
    repositoryId === undefined ? {} : { repositoryId }
  const [view, repositories] = await Promise.all([
    readProcessingActivity(query),
    readRepositoryList(),
  ])

  const repositoryChoices =
    repositories.status === "ready"
      ? repositories.page.items.map((entry) => ({
          id: entry.id,
          nameWithOwner: entry.nameWithOwner,
        }))
      : []

  const shouldPoll =
    view.status === "ready" &&
    view.page.items.some((row) => isProgressing(row.processingState))

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Processing</h1>
        <p className="text-sm text-slate-600">
          Operational outcomes for live extraction. Rejected admission, quarantine and
          infrastructure failure are separate. This surface offers no retry control.
        </p>
      </div>

      {view.status === "unavailable" ? (
        <ConsoleUnavailable
          failure={view.failure}
          heading="Processing activity is not available right now"
        />
      ) : (
        <>
          <ProcessingFilters query={view.query} repositoryChoices={repositoryChoices} />
          {shouldPoll ? <ProcessingPoll /> : null}
          {view.page.items.length === 0 ? (
            <p className="text-sm text-slate-600" data-testid="processing-empty">
              No processing rows match this filter.
            </p>
          ) : (
            <ProcessingActivityTable page={view.page} />
          )}
        </>
      )}
    </section>
  )
}

export default ProcessingPage
