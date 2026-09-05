import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { PullRequestDetailPanel } from "@/components/processing/pull-request-detail"
import { readPullRequestDetail } from "@/server/queries/processing"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * One canonical spelling per pull request. `Number` would accept `01`, ` 1` and
 * `1e3`, which are three more URLs for a resource that has one.
 */
const CANONICAL_NUMBER = /^[1-9][0-9]*$/

const PullRequestDetailPage = async ({
  params,
}: {
  params: Promise<{ repositoryId: string; prNumber: string }>
}) => {
  const { repositoryId, prNumber } = await params
  const view = await readPullRequestDetail(
    repositoryId,
    CANONICAL_NUMBER.test(prNumber) ? Number(prNumber) : Number.NaN,
  )

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Pull request detail</h1>
        <p className="text-sm text-slate-600">
          Admitted knowledge and extraction runs for one pull request. Rejected and
          quarantined outcomes stay distinct from infrastructure failure.
        </p>
      </div>

      {view.status === "unavailable" ? (
        <ConsoleUnavailable
          failure={view.failure}
          heading="Pull request detail is not available right now"
        />
      ) : (
        <PullRequestDetailPanel
          detail={view.detail}
          validationIssues={view.validationIssues}
        />
      )}
    </section>
  )
}

export default PullRequestDetailPage
