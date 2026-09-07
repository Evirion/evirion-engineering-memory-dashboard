import type { GithubInstallation, RepositoryPage } from "@contracts/console"

import { capacitySummary, productStateLabel } from "@/lib/repositories/presentation"

import { RepositoryAxisList } from "./repository-axes"

/**
 * The accessible and entitled repository inventory.
 *
 * The visual primitive is open decision 4. The structure below is what the
 * contract requires either way: one row per repository, three separately
 * labelled axes inside it, the two counts reported separately, and a cursor
 * control that follows the backend's own `nextCursor`. Tests assert accessible
 * names and per-axis text rather than the element, so a later table or card
 * decision does not invalidate an acceptance row.
 */
export const RepositoryCapacity = ({
  summary,
}: {
  summary: RepositoryPage["summary"]
}) => {
  const capacity = capacitySummary(summary)

  return (
    // A description list carries no accessible name of its own, so the named
    // region around it is what makes the capacity block addressable.
    <section
      aria-label="Repository capacity"
      className="rounded border border-slate-300 bg-white px-4 py-3"
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Accessible on GitHub
          </dt>
          {/* Reported separately from the active count, never merged into it. */}
          <dd className="text-sm text-slate-900">{summary.accessibleRepositories}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Active in Evirion
          </dt>
          <dd className="text-sm text-slate-900">{capacity.value}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Allowance
          </dt>
          <dd className="text-sm text-slate-700">{capacity.detail}</dd>
        </div>
      </dl>
    </section>
  )
}

/**
 * Why the inventory is empty, in terms of the one thing left to do.
 *
 * An empty list has four different causes and only one of them is "connect the
 * App". Telling a reader who has just connected to connect again is how the
 * page loses their trust, so each state names its own next step.
 */
export const emptyRepositoryReason = (
  installation: GithubInstallation | null,
): string => {
  if (installation === null || installation.installation === null) {
    return "No repository is accessible yet. Connect the GitHub App, then synchronize."
  }

  const run = installation.latestSyncRun
  if (run === null) {
    return "Connected, but no repository has been read yet. Synchronize to find out which ones this installation can see."
  }

  switch (run.status) {
    case "QUEUED":
    case "RUNNING":
      return "Reading which repositories this installation can see."
    case "FAILED":
      return "The last synchronization did not finish, so no repository has been read. Synchronize again."
    case "COMPLETED":
      return "This installation can see no repository. Adjust which repositories it may access on GitHub, then synchronize again."
    case "UNSUPPORTED":
      return "No repository is accessible yet, and the last synchronization reported a state this Console does not recognize."
    default: {
      const exhaustive: never = run.status
      throw new Error(`unhandled sync run status: ${String(exhaustive)}`)
    }
  }
}

export const RepositoryList = ({
  page,
  installation = null,
}: {
  page: RepositoryPage
  installation?: GithubInstallation | null
}) => {
  if (page.items.length === 0) {
    return (
      <p className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {emptyRepositoryReason(installation)}
      </p>
    )
  }

  return (
    <ul aria-label="Repositories" className="flex flex-col gap-3">
      {page.items.map((repository) => (
        <li
          key={repository.id}
          className="flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <a
              href={`/repositories/${repository.id}`}
              className="text-sm font-semibold text-slate-900 underline underline-offset-2"
            >
              {repository.nameWithOwner}
            </a>
            <span className="text-xs text-slate-600">
              {productStateLabel(repository.productState)}
            </span>
          </div>
          <RepositoryAxisList repository={repository} />
        </li>
      ))}
    </ul>
  )
}

export const RepositoryPagination = ({ page }: { page: RepositoryPage }) =>
  page.page.nextCursor === null ? null : (
    <nav aria-label="Repository pages">
      <a
        href={`/repositories?after=${page.page.nextCursor}`}
        className="text-sm text-slate-900 underline underline-offset-2"
      >
        Next repositories
      </a>
    </nav>
  )
