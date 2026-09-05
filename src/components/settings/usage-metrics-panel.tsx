import type { OrganizationMetrics, OrganizationUsage } from "@contracts/console"

import {
  metricsAdmissionCostView,
  metricsRateLabels,
  metricsWindowNote,
  usageBasisLabel,
  usageCostView,
  usagePeriodLabel,
} from "@/lib/settings/presentation"

export const UsageMetricsPanel = ({
  usage,
  metrics,
}: {
  usage: OrganizationUsage
  metrics: OrganizationMetrics
}) => {
  const usageCost = usageCostView(usage)
  const metricsCost = metricsAdmissionCostView(metrics)
  const rates = metricsRateLabels(metrics)

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Operational usage" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Operational usage</h2>
        <p className="text-sm text-slate-600">{usageBasisLabel(usage.basis)}</p>
        <p className="text-sm text-slate-600">Period: {usagePeriodLabel(usage)}</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">
              Active repositories now
            </dt>
            <dd className="text-sm">{usage.activeRepositories}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">
              Historical PRs processed
            </dt>
            <dd className="text-sm">{usage.historicalPullRequestsProcessed}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Live PRs in period</dt>
            <dd className="text-sm">{usage.livePullRequestsProcessedInPeriod}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">
              Accepted Knowledge Objects
            </dt>
            <dd className="text-sm">{usage.acceptedKnowledgeObjects}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Cost</dt>
            <dd className="text-sm" data-testid="usage-cost">
              {usageCost.headline.amount ?? "No amount yet"} (
              {usageCost.headline.detail})
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Alpha metrics" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Alpha metrics</h2>
        <p className="text-sm text-slate-600">{metricsWindowNote(metrics)}</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Reviewed count</dt>
            <dd className="text-sm">{metrics.review.reviewedCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">
              Approval without edit rate
            </dt>
            <dd className="text-sm">{rates.approvalWithoutEditRate}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Edit rate</dt>
            <dd className="text-sm">{rates.editRate}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">User rejection rate</dt>
            <dd className="text-sm">{rates.userRejectionRate}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">
              Active / superseded / unresolved
            </dt>
            <dd className="text-sm">
              {metrics.lifecycle.activeCount} / {metrics.lifecycle.supersededCount} /{" "}
              {metrics.lifecycle.unresolvedCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">
              Lifecycle resolution rate
            </dt>
            <dd className="text-sm">{rates.lifecycleResolutionRate}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">
              Accepted / rejected / quarantined runs
            </dt>
            <dd className="text-sm">
              {metrics.admission.acceptedRuns} / {metrics.admission.rejectedRuns} /{" "}
              {metrics.admission.quarantinedRuns}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Failed jobs</dt>
            <dd className="text-sm">{metrics.admission.failedJobs}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Quarantine rate</dt>
            <dd className="text-sm">{rates.quarantineRate}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Cost per PR</dt>
            <dd className="text-sm">{rates.costPerPullRequest}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Cost per accepted KO</dt>
            <dd className="text-sm">{rates.costPerAcceptedKnowledgeObject}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Total admission cost</dt>
            <dd className="text-sm" data-testid="metrics-total-cost">
              {metricsCost.headline.amount ?? "No amount yet"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
