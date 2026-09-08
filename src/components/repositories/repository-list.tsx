import type { GithubInstallation, RepositoryPage } from "@contracts/console"
import { ArrowRight } from "lucide-react"

import {
  capacitySummary,
  productStateLabel,
  productStateTone,
} from "@/lib/repositories/presentation"
import { buttonVariants } from "@/components/ui/button"
import { panelVariants } from "@/components/ui/panel"
import { StatusBadge } from "@/components/ui/status-chip"
import { kickerClasses } from "@/components/ui/text"

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
      className={panelVariants({ padding: "none" })}
    >
      <dl className="border-border grid gap-4 p-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-dashed">
        <div className="flex flex-col gap-1 sm:pr-5">
          <dt className={kickerClasses()}>Accessible on GitHub</dt>
          {/* Reported separately from the active count, never merged into it. */}
          <dd className="text-foreground text-xl font-semibold tabular-nums">
            {summary.accessibleRepositories}
          </dd>
        </div>
        <div className="flex flex-col gap-1 sm:px-5">
          <dt className={kickerClasses()}>Active in Evirion</dt>
          <dd className="text-foreground text-xl font-semibold tabular-nums">
            {capacity.value}
          </dd>
        </div>
        <div className="flex flex-col gap-1 sm:pl-5">
          <dt className={kickerClasses()}>Allowance</dt>
          <dd className="text-ink-secondary text-sm leading-5">{capacity.detail}</dd>
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
    // A dashed edge, so an empty list is never mistaken for one still loading.
    return (
      <p className="border-line-default text-ink-secondary rounded-2xl border border-dashed px-5 py-8 text-center text-sm">
        {emptyRepositoryReason(installation)}
      </p>
    )
  }

  return (
    <ul aria-label="Repositories" className="stagger flex flex-col gap-4">
      {page.items.map((repository) => (
        <li
          key={repository.id}
          className={panelVariants({ className: "flex flex-col gap-4" })}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <a
              href={`/repositories/${repository.id}`}
              className="text-foreground hover:text-primary group inline-flex items-center gap-1.5 font-mono text-sm font-semibold"
            >
              {repository.nameWithOwner}
              <ArrowRight
                aria-hidden
                className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                strokeWidth={2}
              />
            </a>
            {/*
              The one coloured thing on the card, and the scan target. It is
              the backend's own rollup across all three axes, rendered whole
              rather than summarised, so live processing mode needs no second
              home and nothing is lost.
            */}
            <StatusBadge tone={productStateTone(repository.productState)}>
              {productStateLabel(repository.productState)}
            </StatusBadge>
          </div>
          <RepositoryAxisList repository={repository} />
        </li>
      ))}
    </ul>
  )
}

export const RepositoryPagination = ({ page }: { page: RepositoryPage }) =>
  page.page.nextCursor === null ? null : (
    <nav aria-label="Repository pages" className="flex justify-center">
      <a
        href={`/repositories?after=${page.page.nextCursor}`}
        className={buttonVariants({ variant: "outline" })}
      >
        Next repositories
      </a>
    </nav>
  )
