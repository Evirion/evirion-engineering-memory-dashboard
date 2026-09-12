import type { ProcessingPage } from "@contracts/console"

import { formatInstant } from "@/lib/format/display"
import { rowView } from "@/lib/processing/presentation"
import {
  nextProcessingSort,
  processingPath,
  type ProcessingSort,
  type ProcessingViewQuery,
} from "@/lib/processing/query"
import { SHOW_COST_FIGURES } from "@/lib/ui/cost-reporting"
import { buttonVariants } from "@/components/ui/button"
import { StatusChip } from "@/components/ui/status-chip"
import {
  Table,
  TableBody,
  TableCell,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Technical } from "@/components/ui/text"

const SORT_LABELS: Readonly<Record<ProcessingSort, string>> = {
  repository: "Repository",
  pullRequest: "PR",
  outcome: "Outcome",
  authorization: "Paid authorization",
  job: "Job / source",
  updated: "Updated",
}

const SortHeader = ({
  column,
  query,
}: {
  column: ProcessingSort
  query: ProcessingViewQuery
}) => {
  const next = nextProcessingSort(query, column)
  const ariaSort =
    query.sort !== column ? "none" : query.dir === "desc" ? "descending" : "ascending"

  return (
    <TableHeader scope="col" aria-sort={ariaSort}>
      <a
        href={processingPath({ ...query, ...next })}
        className="text-inherit no-underline hover:underline"
      >
        {SORT_LABELS[column]}
      </a>
    </TableHeader>
  )
}

/**
 * The one true table in the Console.
 *
 * Every row answers the same scalar questions and the task is comparing them
 * down a column, which is exactly when a table beats a card. Job, source and
 * admission share a cell rather than taking three columns of their own,
 * because eight chip columns do not fit 1440 and the first thing to be
 * clipped was cost. Repository and PR are two PROC-001 fields and two columns.
 */
export const ProcessingActivityTable = ({
  page,
  query,
}: {
  page: ProcessingPage
  query: ProcessingViewQuery
}) => (
  <TableFrame>
    <Table aria-label="Processing activity" data-testid="processing-activity-table">
      <TableHead>
        <TableRow>
          <SortHeader column="repository" query={query} />
          <SortHeader column="pullRequest" query={query} />
          <SortHeader column="outcome" query={query} />
          <SortHeader column="authorization" query={query} />
          <SortHeader column="job" query={query} />
          {SHOW_COST_FIGURES ? <TableHeader scope="col">Cost</TableHeader> : null}
          <SortHeader column="updated" query={query} />
        </TableRow>
      </TableHead>
      <TableBody>
        {page.items.map((row) => {
          const view = rowView(row)
          return (
            <TableRow
              key={row.extractionJobId}
              data-testid="processing-row"
              data-processing-state={row.processingState}
              data-paid-authorization={row.paidAuthorizationStatus}
              data-waiting-on={view.authorization.waitingOn}
            >
              <TableCell>
                <div className="text-foreground font-mono text-sm font-medium">
                  {row.nameWithOwner}
                </div>
              </TableCell>

              <TableCell>
                <div>
                  {row.pullRequestId ? (
                    <a
                      href={`/repositories/${row.repositoryId}/pull-requests/${row.pullRequestNumber}`}
                      className="text-primary hover:text-primary-hover font-mono underline underline-offset-2"
                      data-testid="processing-pr-link"
                    >
                      #{row.pullRequestNumber}
                    </a>
                  ) : (
                    <span className="font-mono">#{row.pullRequestNumber}</span>
                  )}
                </div>
                {row.pullRequestTitle ? (
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {row.pullRequestTitle}
                  </div>
                ) : null}
              </TableCell>

              <TableCell>
                <div data-testid="processing-outcome">
                  <StatusChip tone={view.processingTone}>
                    {view.processingLabel}
                  </StatusChip>
                </div>
                {view.isRejected ? (
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    Rejected admission, not infrastructure failure
                  </p>
                ) : null}
                {view.isQuarantined ? (
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    Quarantined, not infrastructure failure
                  </p>
                ) : null}
                {view.isInfrastructureFailure ? (
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    Infrastructure failure
                  </p>
                ) : null}
                {row.lastErrorCode ? (
                  <p className="mt-1.5" data-testid="processing-error-code">
                    <Technical>Error code {row.lastErrorCode}</Technical>
                  </p>
                ) : null}
                {(view.isRejected ||
                  view.isQuarantined ||
                  view.isInfrastructureFailure ||
                  row.lastErrorCode) && (
                  <p
                    className="text-muted-foreground mt-2 max-w-[42ch] text-xs leading-5"
                    data-testid="processing-support-copy"
                  >
                    {view.supportCopy}
                  </p>
                )}
              </TableCell>

              <TableCell title={view.authorization.detail}>
                <div data-testid="processing-authorization">
                  <StatusChip tone={view.authorizationTone}>
                    {view.authorization.label}
                  </StatusChip>
                </div>
                {/*
                  The sentence appears only where someone is actually being
                  waited on. It is the explanation the two-waits split depends
                  on, and it earns a column's width there. On a row nobody is
                  waiting on it repeats "this job needs no authorization"
                  forever, which is the widest thing in the table saying the
                  least. The full text stays reachable on the row's title.
                */}
                {view.authorization.waitingOn === "nobody" ? null : (
                  <p className="text-muted-foreground mt-1.5 max-w-[34ch] text-xs leading-5">
                    {view.authorization.detail}
                  </p>
                )}
              </TableCell>

              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <StatusChip tone={view.jobTone}>{view.jobLabel}</StatusChip>
                  <StatusChip tone={view.sourceTone}>{view.sourceLabel}</StatusChip>
                  <StatusChip tone={view.admissionTone}>
                    {view.admissionLabel}
                  </StatusChip>
                </div>
              </TableCell>

              {SHOW_COST_FIGURES ? (
                <TableCell data-testid="processing-cost">
                  {view.cost === null ? (
                    <span className="text-muted-foreground text-xs">
                      Not included for your role
                    </span>
                  ) : (
                    <>
                      <div className="text-foreground font-mono text-sm tabular-nums">
                        {view.cost.headline.amount ?? "No amount yet"}
                      </div>
                      <p className="mt-0.5" data-testid="cost-completeness">
                        <Technical>{view.costCompleteness}</Technical>
                      </p>
                    </>
                  )}
                </TableCell>
              ) : null}

              {/*
                The published instant stays on the cell title for anyone who
                needs to quote it. What the column shows is the English short
                form, so a Russian browser never has to read ISO microseconds.
              */}
              <TableCell title={row.updatedAt} className="whitespace-nowrap">
                <Technical className="block">{formatInstant(row.updatedAt)}</Technical>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  </TableFrame>
)

export const ProcessingPagination = ({
  page,
  query,
}: {
  page: ProcessingPage
  query: ProcessingViewQuery
}) => {
  const nextCursor = page.page.nextCursor
  if (nextCursor === null) return null

  return (
    <nav aria-label="Processing pages" className="flex justify-center">
      <a
        href={processingPath({ ...query, after: nextCursor }, { keepCursor: true })}
        className={buttonVariants({ variant: "outline" })}
      >
        Next processing rows
      </a>
    </nav>
  )
}
