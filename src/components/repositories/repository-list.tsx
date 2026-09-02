import type { RepositoryPage } from "@contracts/console"

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

export const RepositoryList = ({ page }: { page: RepositoryPage }) => {
  if (page.items.length === 0) {
    return (
      <p className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        No repository is accessible yet. Connect the GitHub App, or adjust which
        repositories the installation can see, then synchronize.
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
