import type { ProcessingPage } from "@contracts/console"

import { rowView } from "@/lib/processing/presentation"
import { SHOW_COST_FIGURES } from "@/lib/ui/cost-reporting"
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

/**
 * The one true table in the Console.
 *
 * Every row answers the same scalar questions and the task is comparing them
 * down a column, which is exactly when a table beats a card. Job, source and
 * admission share a cell rather than taking three columns of their own,
 * because eight chip columns do not fit 1440 and the first thing to be
 * clipped was cost.
 */
export const ProcessingActivityTable = ({ page }: { page: ProcessingPage }) => (
  <TableFrame>
    <Table aria-label="Processing activity" data-testid="processing-activity-table">
      <TableHead>
        <TableRow>
          <TableHeader scope="col">Repository / PR</TableHeader>
          <TableHeader scope="col">Outcome</TableHeader>
          <TableHeader scope="col">Paid authorization</TableHeader>
          <TableHeader scope="col">Job / source</TableHeader>
          {SHOW_COST_FIGURES ? <TableHeader scope="col">Cost</TableHeader> : null}
          <TableHeader scope="col">Updated</TableHeader>
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
                <div className="text-muted-foreground mt-0.5 text-xs">
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
                  {row.pullRequestTitle ? ` — ${row.pullRequestTitle}` : ""}
                </div>
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

              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <StatusChip tone={view.jobTone}>{view.jobLabel}</StatusChip>
                  <StatusChip tone={view.sourceTone}>{view.sourceLabel}</StatusChip>
                  <StatusChip tone={view.admissionTone}>
                    {view.admissionLabel}
                  </StatusChip>
                </div>
              </TableCell>

              {/*
                The instant is split rather than wrapped. A single ISO string
                with microseconds breaks at whatever character the column edge
                lands on, which is unreadable and moves as the table resizes.
                The date and the time each stay whole, and the exact published
                value is on the cell for anyone who needs to quote it.
              */}
              <TableCell title={row.updatedAt} className="whitespace-nowrap">
                <Technical className="block">{row.updatedAt.slice(0, 10)}</Technical>
                <Technical className="block">{row.updatedAt.slice(11, 19)}</Technical>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  </TableFrame>
)
