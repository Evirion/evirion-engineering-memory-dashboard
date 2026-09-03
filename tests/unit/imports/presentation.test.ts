import { describe, expect, it } from "vitest"

import type { RepositoryImport } from "@contracts/console"

import {
  authorizationView,
  costCompletenessLabel,
  costView,
  dispositionCounts,
  isProgressing,
  missingPrerequisiteLabel,
  progressCounts,
  recoveryActionLabel,
  retryBlockerLabel,
  statusLabel,
  terminationReasonLabel,
} from "@/lib/imports/presentation"

import { IMPORT_RUNS } from "../../../tools/console-stub/fixtures.mjs"

/**
 * EEM-9/04 C04-1.
 *
 * Every published member of every import union is exercised here, so adding one
 * to the contract fails this suite until it has a reviewed reading. The
 * distinctions the subtask exists to get right are asserted as distinctions:
 * the two waits differ, an unresolved cost has no amount, and rejected and
 * quarantined are counted apart from failed.
 */

const STATUSES: readonly RepositoryImport["status"][] = [
  "PLANNING",
  "DISCOVERING",
  "AWAITING_APPROVAL",
  "PROCESSING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]

const AUTHORIZATIONS: readonly RepositoryImport["paidAuthorizationStatus"][] = [
  "NOT_REQUIRED",
  "AWAITING_CUSTOMER_CONSENT",
  "AWAITING_OPERATIONAL_AUTHORIZATION",
  "AUTHORIZED",
  "EXPIRED",
  "REVOKED",
]

const COMPLETENESS: readonly RepositoryImport["cost"]["completeness"][] = [
  "RESERVED",
  "MEASURED",
  "UNRESOLVED",
  "NOT_APPLICABLE",
]

const RECOVERY: readonly RepositoryImport["recoveryAction"][] = [
  "AWAIT_DISCOVERY",
  "APPROVE_IMPORT",
  "GRANT_CUSTOMER_CONSENT",
  "AWAIT_EVIRION_AUTHORIZATION",
  "PAUSE_IMPORT_TO_RETRY",
  "RETRY_JOB",
  "CONTACT_SUPPORT",
  "NONE",
]

const cost = (
  completeness: RepositoryImport["cost"]["completeness"],
  overrides: Partial<RepositoryImport["cost"]> = {},
): RepositoryImport["cost"] => ({
  budgetUsd: "30.000000",
  completeness,
  measuredUsd: "3.000000",
  reservedUsd: "1.000000",
  unresolvedUsd: "2.000000",
  ...overrides,
})

describe("the eight backend states BF-002 maps", () => {
  it.each(STATUSES)(
    "gives %s the user-facing label the requirement fixes",
    (status) => {
      expect(statusLabel(status)).toBeTruthy()
    },
  )

  it("uses exactly the labels the requirement table names", () => {
    expect(STATUSES.map(statusLabel)).toEqual([
      "Preparing import",
      "Discovering PR history",
      "Ready for extraction",
      "Extracting Engineering Memory",
      "Import paused",
      "Import complete",
      "Import failed",
      "Import cancelled",
    ])
  })

  it("polls only where the backend moves the run without a person", () => {
    expect(STATUSES.filter(isProgressing)).toEqual([
      "PLANNING",
      "DISCOVERING",
      "PROCESSING",
    ])
  })

  it("polls on neither an ended run nor one waiting on somebody", () => {
    // The three terminal states have nothing further to report, and the two
    // waiting states would change nothing while discarding a budget in progress.
    for (const status of [
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "AWAITING_APPROVAL",
      "PAUSED",
    ] as const) {
      expect(isProgressing(status), status).toBe(false)
    }
  })
})

describe("the six authorization states", () => {
  it.each(AUTHORIZATIONS)("gives %s its own reading", (status) => {
    expect(authorizationView(status).label).toBeTruthy()
  })

  it("makes all six labels distinct", () => {
    const labels = AUTHORIZATIONS.map((status) => authorizationView(status).label)

    expect(new Set(labels).size).toBe(AUTHORIZATIONS.length)
  })

  it("separates the two waits by who is being waited on", () => {
    const customer = authorizationView("AWAITING_CUSTOMER_CONSENT")
    const evirion = authorizationView("AWAITING_OPERATIONAL_AUTHORIZATION")

    expect(customer.waitingOn).toBe("customer")
    expect(evirion.waitingOn).toBe("evirion")
    expect(customer.label).not.toBe(evirion.label)
  })

  it("offers an action only where the customer has one", () => {
    // Waiting for Evirion is the state this subtask exists to keep actionless.
    // A customer cannot grant operational authorization, so offering anything
    // would be the surface promising what the backend will refuse.
    expect(authorizationView("AWAITING_CUSTOMER_CONSENT").customerAction).toBe(
      "approve",
    )
    expect(authorizationView("EXPIRED").customerAction).toBe("re-request")

    for (const status of [
      "NOT_REQUIRED",
      "AWAITING_OPERATIONAL_AUTHORIZATION",
      "AUTHORIZED",
      "REVOKED",
    ] as const) {
      expect(authorizationView(status).customerAction, status).toBe("none")
    }
  })

  it("says plainly that the Evirion wait has nothing to do", () => {
    const evirion = authorizationView("AWAITING_OPERATIONAL_AUTHORIZATION")

    expect(evirion.detail).toMatch(/nothing to do here/)
    expect(evirion.detail).toMatch(/separate gate/)
  })
})

describe("the four cost states", () => {
  it.each(COMPLETENESS)("labels %s distinctly", (completeness) => {
    expect(costCompletenessLabel(completeness)).toBeTruthy()
  })

  it("never renders an unresolved or inapplicable cost as an amount", () => {
    // Zero is a measurement. An unresolved cost has none, so it must have no
    // figure at all rather than a figure that reads as settled.
    expect(costView(cost("UNRESOLVED")).headline.amount).toBeNull()
    expect(costView(cost("NOT_APPLICABLE")).headline.amount).toBeNull()
  })

  it("shows the settled amount only when the backend says it is settled", () => {
    expect(costView(cost("MEASURED")).headline.amount).toBe("USD 3.000000")
    expect(costView(cost("RESERVED")).headline.amount).toBe("USD 1.000000")
  })

  it("keeps reserved, measured and unresolved as separate named figures", () => {
    const view = costView(cost("RESERVED"))
    const amounts = view.figures.map((figure) => figure.amount)

    expect(view.figures.map((figure) => figure.label)).toEqual([
      "Measured",
      "Reserved",
      "Unresolved",
    ])
    // Summing them would present part-settled money as one settled number.
    expect(amounts).toEqual(["USD 3.000000", "USD 1.000000", "USD 2.000000"])
  })

  it("shows no breakdown at all when no paid work contributed", () => {
    // With no contributing job the three components are all `0.000000`, so a
    // breakdown would put zero-dollar measurements on screen for a state that
    // has nothing to measure. The headline carries the explanation instead.
    const view = costView(
      cost("NOT_APPLICABLE", {
        measuredUsd: "0.000000",
        reservedUsd: "0.000000",
        unresolvedUsd: "0.000000",
      }),
    )

    expect(view.figures).toEqual([])
    expect(view.headline.amount).toBeNull()
    expect(view.headline.detail).toMatch(/No paid work has contributed/)
  })

  it("keeps the breakdown for an unresolved cost, whose parts are real", () => {
    // Unlike not-applicable, an unresolved cost has genuine amounts. Only the
    // single total is withheld, because none of them can stand for it.
    expect(costView(cost("UNRESOLVED")).figures).toHaveLength(3)
  })

  it("distinguishes an absent budget from a zero one", () => {
    expect(costView(cost("MEASURED", { budgetUsd: null })).budget.amount).toBeNull()
    expect(costView(cost("MEASURED", { budgetUsd: "0.000000" })).budget.amount).toBe(
      "USD 0.000000",
    )
  })

  it("never presents a figure as invoice authority", () => {
    // The word may appear, but only to deny it. A settled amount is the one
    // that could be mistaken for a bill, so it carries the denial explicitly.
    for (const completeness of COMPLETENESS) {
      expect(costView(cost(completeness)).headline.detail, completeness).not.toMatch(
        /\bis an invoice\b/i,
      )
    }
    expect(costView(cost("MEASURED")).headline.detail).toMatch(/not an invoice/)
    expect(costView(cost("RESERVED")).headline.detail).toMatch(/not an invoice/)
  })
})

describe("the nine published counters", () => {
  it("reports work and machine outcomes as two separate groups", () => {
    const run = IMPORT_RUNS.completed()
    const work = progressCounts(run.counts).work.map((count) => count.label)
    const outcomes = dispositionCounts(run.dispositions).map((count) => count.label)

    expect(work).toEqual([
      "Discovered",
      "Skipped",
      "Enqueued",
      "Source ready",
      "Completed",
      "Failed",
    ])
    expect(outcomes).toEqual(["Accepted", "Rejected", "Quarantined"])
  })

  it("reads every count straight from the backend aggregate", () => {
    const run = IMPORT_RUNS.completed()
    const values = Object.fromEntries(
      progressCounts(run.counts).work.map((count) => [count.label, count.value]),
    )

    expect(values["Discovered"]).toBe(run.counts.discovered)
    expect(values["Failed"]).toBe(run.counts.failed)
    expect(dispositionCounts(run.dispositions)[2]?.value).toBe(
      run.dispositions.quarantined,
    )
  })

  it("states the processed relationship as the derivation it is", () => {
    // `BF-004` asks for processed of total and the contract publishes neither
    // field, so what is shown is completed and failed against discovered.
    expect(progressCounts(IMPORT_RUNS.completed().counts).summary).toBe(
      "21 completed and 0 failed of 24 discovered",
    )
  })

  it("keeps machine outcomes apart from infrastructure failure", () => {
    const run = IMPORT_RUNS.completed()
    const outcomes = dispositionCounts(run.dispositions)
    const failed = progressCounts(run.counts).work.find(
      (count) => count.label === "Failed",
    )

    // Only the failed work counter is infrastructure. Rejected is a valid
    // model decision and quarantined is invalid model output; neither is a
    // failure of the system and neither can become trusted memory.
    expect(failed?.detail).toMatch(/infrastructure failure, not a model decision/)
    for (const outcome of outcomes.slice(1)) {
      expect(outcome.detail, outcome.label).not.toMatch(/infrastructure/i)
      expect(outcome.detail, outcome.label).toMatch(/never a Knowledge Object/)
    }
    expect(outcomes[0]?.detail).toMatch(/trusted Engineering Memory/)
  })
})

describe("what the backend says to do next", () => {
  it.each(RECOVERY)("has a reviewed reading for %s", (action) => {
    // `NONE` is the one that deliberately renders nothing.
    const label = recoveryActionLabel(action)
    expect(action === "NONE" ? label === null : Boolean(label)).toBe(true)
  })

  it("offers no action for the Evirion wait", () => {
    expect(recoveryActionLabel("AWAIT_EVIRION_AUTHORIZATION")).toMatch(
      /nothing to do here/,
    )
  })

  it("has a reading for every prerequisite and every termination reason", () => {
    expect(missingPrerequisiteLabel(null)).toBeNull()
    for (const prerequisite of [
      "REPOSITORY_BUDGET",
      "CUSTOMER_CONSENT",
      "OPERATIONAL_AUTHORIZATION",
    ] as const) {
      expect(missingPrerequisiteLabel(prerequisite), prerequisite).toBeTruthy()
    }

    expect(terminationReasonLabel(null)).toBeNull()
    for (const reason of [
      "OPERATOR_REVOCATION",
      "ORGANIZATION_OFFBOARDING",
      "EXPIRY",
      "ALLOWANCE_CONSUMED",
    ] as const) {
      expect(terminationReasonLabel(reason), reason).toBeTruthy()
    }
  })

  it("has a reading for every retry blocker", () => {
    expect(retryBlockerLabel(null)).toBeNull()
    for (const blocker of [
      "RESOURCE_NOT_FOUND",
      "REPOSITORY_IMPORT_JOB_NOT_RETRYABLE",
    ] as const) {
      expect(retryBlockerLabel(blocker), blocker).toBeTruthy()
    }
  })
})

describe("a state the contract does not publish", () => {
  it("throws rather than rendering something plausible", () => {
    // The compile-time `never` check is the primary guard. This proves the
    // runtime half, which is what protects a response that got past a
    // validator boundary somewhere else.
    const unknown = "RECONCILING" as RepositoryImport["status"]

    expect(() => statusLabel(unknown)).toThrow(/unhandled import status/)
    expect(() =>
      authorizationView("PENDING" as RepositoryImport["paidAuthorizationStatus"]),
    ).toThrow(/unhandled paid authorization status/)
    expect(() =>
      costCompletenessLabel("ESTIMATED" as RepositoryImport["cost"]["completeness"]),
    ).toThrow(/unhandled cost completeness/)
  })
})
