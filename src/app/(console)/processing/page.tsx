import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  ProcessingActivityTable,
  ProcessingPagination,
} from "@/components/processing/processing-activity-table"
import { ProcessingFilters } from "@/components/processing/processing-filters"
import { ProcessingPoll } from "@/components/processing/processing-poll"
import { isProgressing } from "@/lib/processing/presentation"
import { readProcessingQuery } from "@/lib/processing/query"
import { Lede, PageHeader, PageTitle } from "@/components/ui/text"
import { readProcessingActivity } from "@/server/queries/processing"
import { readRepositoryList } from "@/server/queries/repositories"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * Processing Activity is read-only. No retry, resume, or backend-declared recovery
 * action exists on a live extraction job. PROC-001 requires pagination; the page
 * size is owned here and is never taken from the query string.
 */
const ProcessingPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const query = readProcessingQuery(await searchParams)
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
    // The one table in the Console, and the one page that asks the shell for
    // more than a reading width. Repository and PR are two columns; six-plus
    // inside 1100px left cells wrapping mid-phrase, which is why this surface
    // is wide.
    <section data-wide className="flex flex-col gap-6">
      <PageHeader>
        <PageTitle>Processing</PageTitle>
        <Lede>
          Operational outcomes for live extraction. Rejected admission, quarantine and
          infrastructure failure are separate. This surface offers no retry control.
        </Lede>
      </PageHeader>

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
            <p
              className="border-line-default text-ink-secondary rounded-2xl border border-dashed px-5 py-8 text-center text-sm"
              data-testid="processing-empty"
            >
              No processing rows match this filter.
            </p>
          ) : (
            <>
              <ProcessingActivityTable page={view.page} query={view.query} />
              <ProcessingPagination page={view.page} query={view.query} />
            </>
          )}
        </>
      )}
    </section>
  )
}

export default ProcessingPage
