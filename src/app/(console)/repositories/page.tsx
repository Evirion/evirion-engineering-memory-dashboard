import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  RepositoryCapacity,
  RepositoryList,
  RepositoryPagination,
} from "@/components/repositories/repository-list"
import { readRepositoryList, validRepositoryId } from "@/server/queries/repositories"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * Accessible and entitled repositories, with capacity and slot state.
 *
 * GitHub access, Evirion entitlement and live processing policy are three
 * independent axes and are rendered as three, never as one status. The counts
 * are reported separately for the same reason: an accessible repository is not
 * an active one, and nothing is read from a repository until it is activated.
 */
const RepositoriesPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const parameters = await searchParams
  const requested = parameters["after"]
  // A cursor is a repository identifier. Anything else is dropped rather than
  // forwarded, so a caller cannot steer the path the adapter builds.
  const after = validRepositoryId(typeof requested === "string" ? requested : undefined)

  const view = await readRepositoryList(after)

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Repositories</h1>
        <p className="text-sm text-slate-600">
          GitHub access, Evirion entitlement and live processing are separate. A
          repository is read only once it is activated here.
        </p>
      </div>

      {view.status === "unavailable" ? (
        <ConsoleUnavailable
          failure={view.failure}
          heading="Repositories are not available right now"
        />
      ) : (
        <>
          <RepositoryCapacity summary={view.page.summary} />
          <RepositoryList page={view.page} />
          <RepositoryPagination page={view.page} />
        </>
      )}
    </section>
  )
}

export default RepositoriesPage
