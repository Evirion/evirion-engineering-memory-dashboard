import type { ProcessingPage } from "@contracts/console"

import { rowView } from "@/lib/processing/presentation"

export const ProcessingActivityTable = ({ page }: { page: ProcessingPage }) => (
  <div className="overflow-x-auto rounded border border-slate-200">
    <table
      className="min-w-full text-left text-sm"
      aria-label="Processing activity"
      data-testid="processing-activity-table"
    >
      <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
        <tr>
          <th scope="col" className="px-3 py-2">
            Repository / PR
          </th>
          <th scope="col" className="px-3 py-2">
            Outcome
          </th>
          <th scope="col" className="px-3 py-2">
            Paid authorization
          </th>
          <th scope="col" className="px-3 py-2">
            Job / source
          </th>
          <th scope="col" className="px-3 py-2">
            Cost
          </th>
          <th scope="col" className="px-3 py-2">
            Updated
          </th>
        </tr>
      </thead>
      <tbody>
        {page.items.map((row) => {
          const view = rowView(row)
          return (
            <tr
              key={row.extractionJobId}
              data-testid="processing-row"
              data-processing-state={row.processingState}
              data-paid-authorization={row.paidAuthorizationStatus}
              data-waiting-on={view.authorization.waitingOn}
              className="border-t border-slate-200 align-top"
            >
              <td className="px-3 py-3">
                <div className="font-medium text-slate-900">{row.nameWithOwner}</div>
                <div className="text-slate-600">
                  {row.pullRequestId ? (
                    <a
                      href={`/repositories/${row.repositoryId}/pull-requests/${row.pullRequestNumber}`}
                      className="underline"
                      data-testid="processing-pr-link"
                    >
                      #{row.pullRequestNumber}
                    </a>
                  ) : (
                    <>#{row.pullRequestNumber}</>
                  )}
                  {row.pullRequestTitle ? ` — ${row.pullRequestTitle}` : ""}
                </div>
              </td>
              <td className="px-3 py-3">
                <div data-testid="processing-outcome">{view.processingLabel}</div>
                {view.isRejected ? (
                  <p className="text-xs text-slate-600">
                    Rejected admission, not infrastructure failure
                  </p>
                ) : null}
                {view.isQuarantined ? (
                  <p className="text-xs text-slate-600">
                    Quarantined, not infrastructure failure
                  </p>
                ) : null}
                {view.isInfrastructureFailure ? (
                  <p className="text-xs text-slate-600">Infrastructure failure</p>
                ) : null}
                {row.lastErrorCode ? (
                  <p
                    className="text-xs text-slate-600"
                    data-testid="processing-error-code"
                  >
                    Error code {row.lastErrorCode}
                  </p>
                ) : null}
                {(view.isRejected ||
                  view.isQuarantined ||
                  view.isInfrastructureFailure ||
                  row.lastErrorCode) && (
                  <p
                    className="mt-2 text-xs text-slate-600"
                    data-testid="processing-support-copy"
                  >
                    {view.supportCopy}
                  </p>
                )}
              </td>
              <td className="px-3 py-3">
                <div data-testid="processing-authorization">
                  {view.authorization.label}
                </div>
                <p className="text-xs text-slate-600">{view.authorization.detail}</p>
              </td>
              <td className="px-3 py-3">
                <div>{view.jobLabel}</div>
                <div className="text-xs text-slate-600">{view.sourceLabel}</div>
                <div className="text-xs text-slate-600">
                  Admission: {view.admissionLabel}
                </div>
              </td>
              <td className="px-3 py-3" data-testid="processing-cost">
                {view.cost === null ? (
                  <span className="text-slate-600">Not included for your role</span>
                ) : (
                  <>
                    <div>{view.cost.headline.amount ?? "No amount yet"}</div>
                    <div
                      className="text-xs text-slate-600"
                      data-testid="cost-completeness"
                    >
                      {view.costCompleteness}
                    </div>
                  </>
                )}
              </td>
              <td className="px-3 py-3 text-slate-600">{row.updatedAt}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)
