import type { OrganizationMetrics, OrganizationUsage } from "@contracts/console"

import {
  metricsAdmissionCostView,
  metricsRateLabels,
  metricsWindowNote,
  usageBasisLabel,
  usageCostView,
  usagePeriodLabel,
} from "@/lib/settings/presentation"
import { SHOW_COST_FIGURES } from "@/lib/ui/cost-reporting"
import { Metric, MetricGrid } from "@/components/ui/metric"
import { SectionTitle, Technical } from "@/components/ui/text"

/**
 * Operational figures, and never an invoice.
 *
 * Every cost here carries its completeness beside it, because a reserved
 * figure and a settled one are not the same claim, and the period or cutoff
 * travels with the block for the same reason: two figures taken at different
 * boundaries cannot be compared.
 */
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
    <div className="flex flex-col gap-10">
      <section aria-label="Operational usage" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <SectionTitle>Operational usage</SectionTitle>
          <p className="text-ink-secondary text-sm leading-6">
            {usageBasisLabel(usage.basis)}
          </p>
          <Technical>Period: {usagePeriodLabel(usage)}</Technical>
        </div>
        <MetricGrid>
          <Metric label="Active repositories now" value={usage.activeRepositories} />
          <Metric
            label="Historical PRs processed"
            value={usage.historicalPullRequestsProcessed}
          />
          <Metric
            label="Live PRs in period"
            value={usage.livePullRequestsProcessedInPeriod}
          />
          <Metric
            label="Accepted Knowledge Objects"
            value={usage.acceptedKnowledgeObjects}
          />
          {SHOW_COST_FIGURES ? (
            <Metric
              label="Cost"
              data-testid="usage-cost"
              value={usageCost.headline.amount ?? "No amount yet"}
              detail={usageCost.headline.detail}
            />
          ) : null}
        </MetricGrid>
      </section>

      <section aria-label="Alpha metrics" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <SectionTitle>Alpha metrics</SectionTitle>
          <Technical className="max-w-[80ch] leading-5">
            {metricsWindowNote(metrics)}
          </Technical>
        </div>
        <MetricGrid>
          <Metric label="Reviewed count" value={metrics.review.reviewedCount} />
          <Metric
            label="Approval without edit rate"
            value={rates.approvalWithoutEditRate}
          />
          <Metric label="Edit rate" value={rates.editRate} />
          <Metric label="User rejection rate" value={rates.userRejectionRate} />
          <Metric
            label="Active / superseded / unresolved"
            value={`${metrics.lifecycle.activeCount} / ${metrics.lifecycle.supersededCount} / ${metrics.lifecycle.unresolvedCount}`}
          />
          <Metric
            label="Lifecycle resolution rate"
            value={rates.lifecycleResolutionRate}
          />
          <Metric
            label="Accepted / rejected / quarantined runs"
            value={`${metrics.admission.acceptedRuns} / ${metrics.admission.rejectedRuns} / ${metrics.admission.quarantinedRuns}`}
          />
          <Metric label="Failed jobs" value={metrics.admission.failedJobs} />
          <Metric label="Quarantine rate" value={rates.quarantineRate} />
          {SHOW_COST_FIGURES ? (
            <>
              <Metric label="Cost per PR" value={rates.costPerPullRequest} />
              <Metric
                label="Cost per accepted KO"
                value={rates.costPerAcceptedKnowledgeObject}
              />
              <Metric
                label="Total admission cost"
                data-testid="metrics-total-cost"
                value={metricsCost.headline.amount ?? "No amount yet"}
              />
            </>
          ) : null}
        </MetricGrid>
      </section>
    </div>
  )
}
