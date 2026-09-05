import type { PullRequestDetail } from "@contracts/console"

import { costViewFromBlock } from "@/lib/settings/cost"
import type { ValidationIssuesEntry } from "@/server/queries/processing"

export const PullRequestDetailPanel = ({
  detail,
  validationIssues,
}: {
  detail: PullRequestDetail
  validationIssues: Readonly<Record<string, ValidationIssuesEntry>>
}) => {
  const cost = detail.cost === undefined ? null : costViewFromBlock(detail.cost)

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Pull request summary" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          {detail.nameWithOwner} #{detail.pullRequestNumber}
        </h2>
        {detail.title ? <p className="text-sm text-slate-700">{detail.title}</p> : null}
        <p className="text-sm text-slate-600">State: {detail.currentState}</p>
        {detail.authorLogin ? (
          <p className="text-sm text-slate-600">Author: {detail.authorLogin}</p>
        ) : null}
        {detail.mergedAt ? (
          <p className="text-sm text-slate-600">Merged at: {detail.mergedAt}</p>
        ) : null}
        {detail.pullRequestUrl ? (
          <a
            href={detail.pullRequestUrl}
            className="text-sm text-slate-900 underline"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub
          </a>
        ) : null}
        {cost === null ? (
          <p className="text-sm text-slate-600">Cost not included for your role</p>
        ) : (
          <p className="text-sm text-slate-600" data-testid="pull-request-cost">
            {cost.headline.amount ?? "No amount yet"}
          </p>
        )}
      </section>

      <section aria-label="Admitted knowledge" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Admitted knowledge</h2>
        {detail.admittedKnowledgeObjects.length === 0 ? (
          <p className="text-sm text-slate-600">No admitted knowledge objects.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {detail.admittedKnowledgeObjects.map((object) => (
              <li key={object.knowledgeObjectId}>
                <a
                  href={`/memory/${object.knowledgeObjectId}`}
                  className="font-medium text-slate-900 underline"
                >
                  {object.shortClaim}
                </a>
                <span className="text-slate-600"> — {object.knowledgeType}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Extraction runs" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Extraction runs</h2>
        <table className="min-w-full text-left text-sm" aria-label="Extraction runs">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-2 py-1">
                Disposition
              </th>
              <th scope="col" className="px-2 py-1">
                Completed
              </th>
              <th scope="col" className="px-2 py-1">
                Validation
              </th>
            </tr>
          </thead>
          <tbody>
            {detail.runs.map((run) => {
              const issues = validationIssues[run.extractionRunId]
              return (
                <tr
                  key={run.extractionRunId}
                  data-testid="pull-request-run"
                  data-disposition={run.disposition}
                  className="border-t border-slate-200 align-top"
                >
                  <td className="px-2 py-2">
                    <div>{run.disposition}</div>
                    {run.rejectionReason ? (
                      <p className="text-xs text-slate-600">{run.rejectionReason}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-slate-600">{run.completedAt}</td>
                  <td className="px-2 py-2">
                    {issues?.status === "unavailable" ? (
                      <p
                        className="text-xs text-slate-600"
                        data-testid="validation-issues-unavailable"
                      >
                        The validation detail could not be read. This is not the same as
                        no issues; try again shortly.
                      </p>
                    ) : issues?.status === "ready" ? (
                      <ul className="list-disc pl-4 text-xs text-slate-600">
                        {issues.issues.issues.map((issue) => (
                          <li key={issue.ordinal}>
                            {issue.code}: {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : run.validationIssueCategories.length > 0 ? (
                      <p className="text-xs text-slate-600">
                        {run.validationIssueCategories.join(", ")}
                      </p>
                    ) : (
                      <span className="text-slate-600">None</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
