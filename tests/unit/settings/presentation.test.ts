import { describe, expect, it } from "vitest"

import {
  githubInstallationStatusLabel,
  memberRoleLabel,
  memberStatusLabel,
  metricsRateLabels,
  metricsWindowNote,
  offboardingStateLabel,
  usageBasisLabel,
  usagePeriodLabel,
} from "@/lib/settings/presentation"

import {
  ORGANIZATION_METRICS,
  ORGANIZATION_USAGE,
} from "../../../tools/console-stub/fixtures.mjs"

describe("settings presentation", () => {
  it("labels every published member role and status", () => {
    for (const role of ["owner", "admin", "reviewer", "viewer"] as const) {
      expect(memberRoleLabel(role)).toBeTruthy()
    }
    for (const status of ["INVITED", "ACTIVE", "DISABLED"] as const) {
      expect(memberStatusLabel(status)).toBeTruthy()
    }
  })

  it("labels every published offboarding state", () => {
    for (const state of [
      "REQUESTED",
      "EXECUTING",
      "FAILED",
      "COMPLETED",
      "REJECTED",
      "UNSUPPORTED",
    ] as const) {
      expect(offboardingStateLabel(state)).toBeTruthy()
    }
  })

  it("labels every published installation status", () => {
    for (const status of [
      "ACTIVE",
      "SUSPENDED",
      "REMOVED",
      "UNSUPPORTED_SERVER_RESPONSE",
    ] as const) {
      expect(githubInstallationStatusLabel(status)).toBeTruthy()
    }
  })

  it("states usage is operational and not an invoice", () => {
    const usage = ORGANIZATION_USAGE()
    expect(usageBasisLabel(usage.basis)).toContain("not an invoice")
    expect(usagePeriodLabel(usage)).toContain("2026-09-01")
  })

  it("names the metrics window beside asOf", () => {
    const metrics = ORGANIZATION_METRICS()
    const note = metricsWindowNote(metrics)
    expect(note).toContain(metrics.asOf)
    expect(note).toContain("not comparable")
  })

  it("never renders unresolved rate costs as a settled amount", () => {
    const metrics = {
      ...ORGANIZATION_METRICS(),
      admission: {
        ...ORGANIZATION_METRICS().admission,
        costPerPullRequest: {
          completeness: "UNRESOLVED" as const,
          denominator: 9,
          measuredUsd: null,
        },
        costPerAcceptedKnowledgeObject: {
          completeness: "NOT_APPLICABLE" as const,
          denominator: 8,
          measuredUsd: null,
        },
      },
    }
    const rates = metricsRateLabels(metrics)
    expect(rates.costPerPullRequest).toBe("Pending reconciliation")
    expect(rates.costPerAcceptedKnowledgeObject).toBe("Not applicable")
  })

  it("marks zero-denominator rates unavailable", () => {
    const metrics = {
      ...ORGANIZATION_METRICS(),
      review: {
        ...ORGANIZATION_METRICS().review,
        reviewedCount: 0,
        approvalWithoutEditRate: null,
        editRate: null,
        userRejectionRate: null,
        criticalOverclaimRate: null,
      },
    }
    const rates = metricsRateLabels(metrics)
    expect(rates.approvalWithoutEditRate).toBe("Unavailable")
  })
})
