import { describe, expect, it } from "vitest"

import type { ProcessingPage } from "@contracts/console"

import {
  isProgressing,
  paidAuthorizationView,
  processingStateLabel,
  rowView,
} from "@/lib/processing/presentation"
import { costViewFromBlock } from "@/lib/settings/cost"

const baseRow = (): ProcessingPage["items"][number] => ({
  mappingVersion: "1",
  extractionJobId: "00000000-0000-4000-8000-00000000b001",
  effectiveJobId: "00000000-0000-4000-8000-00000000b001",
  isAlias: false,
  repositoryId: "00000000-0000-4000-8000-000000000007",
  nameWithOwner: "acme/payments-api",
  pullRequestNumber: 42,
  pullRequestTitle: "Add webhook handler",
  jobStatus: "COMPLETED",
  sourceStatus: "READY",
  admissionDisposition: "ACCEPTED",
  attempts: 1,
  sourceAttempts: 1,
  paidAuthorizationStatus: "AUTHORIZED",
  processingState: "ACCEPTED",
  lastErrorCode: null,
  sourceLastErrorCode: null,
  updatedAt: "2026-09-01T12:00:00Z",
})

describe("processing presentation", () => {
  it("labels every published processing state", () => {
    const states = [
      "ACCEPTED",
      "REJECTED",
      "QUARANTINED",
      "FAILED",
      "SOURCE_FAILED",
      "COLLECTING_SOURCE",
      "AWAITING_APPROVAL",
      "NOT_AUTHORIZED",
      "AWAITING_EVIRION_AUTHORIZATION",
      "AWAITING_CUSTOMER_CONSENT",
      "EXTRACTING",
      "UNSUPPORTED_SERVER_RESPONSE",
    ] as const

    for (const state of states) {
      expect(processingStateLabel(state)).toBeTruthy()
    }
  })

  it("keeps rejected, quarantined and infrastructure failure distinct", () => {
    const rejected = rowView({
      ...baseRow(),
      processingState: "REJECTED",
      admissionDisposition: "REJECTED",
    })
    const quarantined = rowView({
      ...baseRow(),
      processingState: "QUARANTINED",
      admissionDisposition: "QUARANTINED",
    })
    const failed = rowView({
      ...baseRow(),
      processingState: "FAILED",
      admissionDisposition: null,
    })

    expect(rejected.isRejected).toBe(true)
    expect(rejected.isQuarantined).toBe(false)
    expect(quarantined.isQuarantined).toBe(true)
    expect(failed.isInfrastructureFailure).toBe(true)
  })

  it("keeps customer and Evirion waits distinct with no action", () => {
    const customer = paidAuthorizationView("AWAITING_CUSTOMER_CONSENT")
    const evirion = paidAuthorizationView("AWAITING_OPERATIONAL_AUTHORIZATION")

    expect(customer.waitingOn).toBe("customer")
    expect(evirion.waitingOn).toBe("evirion")
    expect(customer.label).not.toEqual(evirion.label)
  })

  it("never renders unresolved or not-applicable cost as a measured amount", () => {
    for (const completeness of ["UNRESOLVED", "NOT_APPLICABLE"] as const) {
      const view = costViewFromBlock({
        completeness,
        measuredUsd: "0.000000",
        reservedUsd: "1.000000",
        unresolvedUsd: "2.000000",
      })
      expect(view.headline.amount).toBeNull()
    }

    const reserved = costViewFromBlock({
      completeness: "RESERVED",
      measuredUsd: "0.000000",
      reservedUsd: "1.000000",
      unresolvedUsd: "2.000000",
    })
    expect(reserved.headline.amount).toBe("USD 1.000000")
  })

  it("treats absent cost as absence in the row view", () => {
    const { cost: _cost, ...withoutCost } = baseRow()
    const view = rowView(withoutCost)
    expect(view.cost).toBeNull()
  })

  it("polls only while extracting or collecting source", () => {
    expect(isProgressing("EXTRACTING")).toBe(true)
    expect(isProgressing("COLLECTING_SOURCE")).toBe(true)
    expect(isProgressing("AWAITING_CUSTOMER_CONSENT")).toBe(false)
    expect(isProgressing("AWAITING_EVIRION_AUTHORIZATION")).toBe(false)
  })

  it("offers no recovery capability in row view", () => {
    const view = rowView({
      ...baseRow(),
      processingState: "FAILED",
      lastErrorCode: "PROVIDER_TIMEOUT",
    })
    expect(view.supportCopy.toLowerCase()).toContain("retry is not available")
    expect("recoveryAction" in view).toBe(false)
  })
})
