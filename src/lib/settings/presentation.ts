import type {
  GithubSettingsSummary,
  Member,
  OrganizationMetrics,
  OrganizationOffboarding,
  OrganizationUsage,
} from "@contracts/console"

import { costViewFromBlock, metricsRateCostLabel, rateLabel } from "@/lib/settings/cost"

export const memberRoleLabel = (role: Member["role"]): string => {
  switch (role) {
    case "owner":
      return "Owner"
    case "admin":
      return "Admin"
    case "reviewer":
      return "Reviewer"
    case "viewer":
      return "Viewer"
    default: {
      const exhaustive: never = role
      throw new Error(`unhandled member role: ${String(exhaustive)}`)
    }
  }
}

export const memberStatusLabel = (status: Member["status"]): string => {
  switch (status) {
    case "INVITED":
      return "Invited"
    case "ACTIVE":
      return "Active"
    case "DISABLED":
      return "Disabled"
    default: {
      const exhaustive: never = status
      throw new Error(`unhandled member status: ${String(exhaustive)}`)
    }
  }
}

export const offboardingStateLabel = (
  state: OrganizationOffboarding["state"],
): string => {
  switch (state) {
    case "REQUESTED":
      return "Requested"
    case "EXECUTING":
      return "Executing"
    case "FAILED":
      return "Failed"
    case "COMPLETED":
      return "Completed"
    case "REJECTED":
      return "Rejected"
    case "UNSUPPORTED":
      return "Unsupported"
    default: {
      const exhaustive: never = state
      throw new Error(`unhandled offboarding state: ${String(exhaustive)}`)
    }
  }
}

export const githubInstallationStatusLabel = (
  status: NonNullable<GithubSettingsSummary["installation"]>["status"],
): string => {
  switch (status) {
    case "ACTIVE":
      return "Active"
    case "SUSPENDED":
      return "Suspended"
    case "REMOVED":
      return "Removed"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported"
    default: {
      const exhaustive: never = status
      throw new Error(`unhandled installation status: ${String(exhaustive)}`)
    }
  }
}

export const usageBasisLabel = (_basis: OrganizationUsage["basis"]): string =>
  "Operational figures, not an invoice"

export const metricsWindowNote = (metrics: OrganizationMetrics): string => {
  const scope =
    metrics.repositoryId === null
      ? "every extraction job created at or before the cutoff"
      : "every extraction job for this repository created at or before the cutoff"
  return `Counted as of ${metrics.asOf} over ${scope}. Figures taken at different cutoffs are not comparable.`
}

export const usagePeriodLabel = (usage: OrganizationUsage): string =>
  `${usage.period.start} through ${usage.period.end} (${usage.period.timezone})`

export const usageCostView = (usage: OrganizationUsage) => costViewFromBlock(usage.cost)

export const metricsAdmissionCostView = (metrics: OrganizationMetrics) =>
  costViewFromBlock(metrics.admission.totalCost)

export const metricsRateLabels = (metrics: OrganizationMetrics) => ({
  quarantineRate: rateLabel(
    metrics.admission.quarantineRate,
    metrics.admission.terminalRuns,
  ),
  evidenceValidityRate: rateLabel(
    metrics.admission.evidenceValidityRate,
    metrics.admission.terminalRuns,
  ),
  approvalWithoutEditRate: rateLabel(
    metrics.review.approvalWithoutEditRate,
    metrics.review.reviewedCount,
  ),
  editRate: rateLabel(metrics.review.editRate, metrics.review.reviewedCount),
  userRejectionRate: rateLabel(
    metrics.review.userRejectionRate,
    metrics.review.reviewedCount,
  ),
  criticalOverclaimRate: rateLabel(
    metrics.review.criticalOverclaimRate,
    metrics.review.reviewedCount,
  ),
  lifecycleResolutionRate: rateLabel(
    metrics.lifecycle.lifecycleResolutionRate,
    metrics.lifecycle.activeCount +
      metrics.lifecycle.supersededCount +
      metrics.lifecycle.unresolvedCount +
      metrics.lifecycle.withdrawnCount,
  ),
  costPerPullRequest: metricsRateCostLabel(metrics.admission.costPerPullRequest),
  costPerAcceptedKnowledgeObject: metricsRateCostLabel(
    metrics.admission.costPerAcceptedKnowledgeObject,
  ),
  latencyPerPullRequest:
    metrics.admission.latencyPerPullRequest.denominator === 0 ||
    metrics.admission.latencyPerPullRequest.seconds === null
      ? "Unavailable"
      : `${metrics.admission.latencyPerPullRequest.seconds.toFixed(2)} s`,
})
