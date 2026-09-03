import type { RepositoryImport, RepositoryImportFailures } from "@contracts/console"

/**
 * How one historical import reads on screen.
 *
 * Nothing here decides anything. Status, authorization, cost completeness,
 * recovery and every count arrive from the backend projection and are only
 * rendered. In particular retryability is never derived: a control appears
 * because the projection declared the capability, not because a status looked
 * like it should allow one.
 *
 * The wording below is neutral text derived from the contract's own vocabulary
 * and from the state table `BF-002` fixes. It is not approved product copy:
 * open decision 3 owns the customer-facing wording for the four confusable
 * terms and is recorded in `docs/architecture/console-ui-conventions.md`.
 */

export type ImportStatus = RepositoryImport["status"]
export type PaidAuthorizationStatus = RepositoryImport["paidAuthorizationStatus"]
export type CostCompleteness = RepositoryImport["cost"]["completeness"]
export type ImportRecoveryAction = RepositoryImport["recoveryAction"]
export type ImportFailure = RepositoryImportFailures["failures"][number]

export const TERMINAL_STATUSES: readonly ImportStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]

/** A terminal run has nothing further to report, so polling stops on one. */
export const isTerminal = (status: ImportStatus): boolean =>
  TERMINAL_STATUSES.includes(status)

/** The user-facing label `BF-002` fixes for each backend state. */
export const statusLabel = (status: ImportStatus): string => {
  switch (status) {
    case "PLANNING":
      return "Preparing import"
    case "DISCOVERING":
      return "Discovering PR history"
    case "AWAITING_APPROVAL":
      return "Ready for extraction"
    case "PROCESSING":
      return "Extracting Engineering Memory"
    case "PAUSED":
      return "Import paused"
    case "COMPLETED":
      return "Import complete"
    case "FAILED":
      return "Import failed"
    case "CANCELLED":
      return "Import cancelled"
    default: {
      const exhaustive: never = status
      throw new Error(`unhandled import status: ${String(exhaustive)}`)
    }
  }
}

/**
 * The two waits, and the four states that are not waits.
 *
 * Waiting for the customer is the only one of the six that carries an action.
 * Waiting for Evirion carries none and must not appear to: a customer cannot
 * grant Evirion operational authorization, and a control that implied otherwise
 * would be the surface promising something the backend will refuse.
 */
export type AuthorizationView = {
  readonly label: string
  readonly detail: string
  /** Who the run is waiting on, or nobody. Never colour alone. */
  readonly waitingOn: "customer" | "evirion" | "nobody"
  readonly customerAction: "approve" | "re-request" | "none"
}

export const authorizationView = (
  status: PaidAuthorizationStatus,
): AuthorizationView => {
  switch (status) {
    case "NOT_REQUIRED":
      return {
        label: "No paid extraction required",
        detail:
          "This import needs no model call, so no consent and no Evirion authorization apply to it.",
        waitingOn: "nobody",
        customerAction: "none",
      }
    case "AWAITING_CUSTOMER_CONSENT":
      return {
        label: "Waiting for your approval",
        detail:
          "Extraction has not been approved yet. Approving records your consent to paid extraction for this import.",
        waitingOn: "customer",
        customerAction: "approve",
      }
    case "AWAITING_OPERATIONAL_AUTHORIZATION":
      return {
        label: "Waiting for Evirion authorization",
        detail:
          "Your approval is recorded. Evirion operational authorization is a separate gate that only Evirion can grant, so there is nothing to do here and no model call has been made.",
        waitingOn: "evirion",
        customerAction: "none",
      }
    case "AUTHORIZED":
      return {
        label: "Authorized",
        detail:
          "Your approval and Evirion operational authorization are both in place for this import.",
        waitingOn: "nobody",
        customerAction: "none",
      }
    case "EXPIRED":
      return {
        label: "Authorization expired",
        detail:
          "The authorization for this import has expired and no further model call will be made under it. Approving again starts a fresh request.",
        waitingOn: "customer",
        customerAction: "re-request",
      }
    case "REVOKED":
      return {
        label: "Authorization revoked",
        detail:
          "Evirion revoked authorization for this import. No undispatched model call will run, and nothing already recorded is removed. Contact Evirion to discuss it.",
        waitingOn: "nobody",
        customerAction: "none",
      }
    default: {
      const exhaustive: never = status
      throw new Error(`unhandled paid authorization status: ${String(exhaustive)}`)
    }
  }
}

/**
 * What the run is missing, when the backend names it.
 *
 * A budget is the customer's to set, so it is stated as an action. Consent is
 * the customer's too. Operational authorization is not, and says so.
 */
export const missingPrerequisiteLabel = (
  prerequisite: RepositoryImport["missingPrerequisite"],
): string | null => {
  if (prerequisite === null) return null

  switch (prerequisite) {
    case "REPOSITORY_BUDGET":
      return "A cost budget has not been set for this repository."
    case "CUSTOMER_CONSENT":
      return "Your approval for paid extraction has not been recorded."
    case "OPERATIONAL_AUTHORIZATION":
      return "Evirion operational authorization is not in place. Only Evirion can grant it."
    default: {
      const exhaustive: never = prerequisite
      throw new Error(`unhandled missing prerequisite: ${String(exhaustive)}`)
    }
  }
}

export const terminationReasonLabel = (
  reason: RepositoryImport["terminationReasonCategory"],
): string | null => {
  if (reason === null) return null

  switch (reason) {
    case "OPERATOR_REVOCATION":
      return "An Evirion operator ended this run."
    case "ORGANIZATION_OFFBOARDING":
      return "This run ended because the organization is being offboarded."
    case "EXPIRY":
      return "This run ended because its authorization expired."
    case "ALLOWANCE_CONSUMED":
      return "This run ended because its allowance was fully consumed."
    default: {
      const exhaustive: never = reason
      throw new Error(`unhandled termination reason: ${String(exhaustive)}`)
    }
  }
}

/**
 * What the backend says to do next.
 *
 * This is the projection's own recovery vocabulary, not a status reading. It
 * is rendered as guidance; whether a control exists beside it is decided by
 * `capabilities` and by each failure's own `retryable`.
 */
export const recoveryActionLabel = (action: ImportRecoveryAction): string | null => {
  switch (action) {
    case "AWAIT_DISCOVERY":
      return "Discovery is still running. Nothing to do yet."
    case "APPROVE_IMPORT":
      return "Approve extraction to let this import continue."
    case "GRANT_CUSTOMER_CONSENT":
      return "Record your approval for paid extraction."
    case "AWAIT_EVIRION_AUTHORIZATION":
      return "Evirion authorization is pending. There is nothing to do here."
    case "PAUSE_IMPORT_TO_RETRY":
      return "Pause this import before retrying the failed work."
    case "RETRY_JOB":
      return "Retry the failed work listed below."
    case "CONTACT_SUPPORT":
      return "Contact Evirion with the run reference below."
    case "NONE":
      return null
    default: {
      const exhaustive: never = action
      throw new Error(`unhandled recovery action: ${String(exhaustive)}`)
    }
  }
}

export const retryBlockerLabel = (
  blocker: ImportFailure["retryBlocker"],
): string | null => {
  if (blocker === null) return null

  switch (blocker) {
    case "RESOURCE_NOT_FOUND":
      return "The work this failure refers to is no longer available."
    case "REPOSITORY_IMPORT_JOB_NOT_RETRYABLE":
      return "The backend has declared this work not retryable."
    default: {
      const exhaustive: never = blocker
      throw new Error(`unhandled retry blocker: ${String(exhaustive)}`)
    }
  }
}

/**
 * The four cost states, which are disjoint by construction.
 *
 * They are derived from the stored completeness rather than inferred from an
 * amount, so an unresolved figure can never be read as a measured zero. No
 * figure here is an invoice.
 */
export type CostFigure = {
  readonly label: string
  /** `null` means there is no amount to show, which is never the same as 0. */
  readonly amount: string | null
  readonly detail: string
}

export type CostView = {
  readonly completeness: CostCompleteness
  readonly headline: CostFigure
  readonly figures: readonly CostFigure[]
  readonly budget: CostFigure
}

const usd = (amount: string): string => `USD ${amount}`

export const costView = (cost: RepositoryImport["cost"]): CostView => {
  const budget: CostFigure = {
    label: "Approved budget",
    amount: cost.budgetUsd === null ? null : usd(cost.budgetUsd),
    detail:
      cost.budgetUsd === null
        ? "No budget has been approved for this import yet."
        : "The ceiling you approved for this import.",
  }

  // Reserved and unresolved travel beside the measured amount as separately
  // named figures. Summing them would present one number as settled when part
  // of it is not.
  const figures: readonly CostFigure[] = [
    {
      label: "Measured",
      amount: usd(cost.measuredUsd),
      detail: "Settled and attributed to this import.",
    },
    {
      label: "Reserved",
      amount: usd(cost.reservedUsd),
      detail: "Held against the budget and not yet settled.",
    },
    {
      label: "Unresolved",
      amount: usd(cost.unresolvedUsd),
      detail: "Recorded but not yet attributable to this import.",
    },
  ]

  switch (cost.completeness) {
    case "MEASURED":
      return {
        completeness: cost.completeness,
        headline: {
          label: "Cost",
          amount: usd(cost.measuredUsd),
          detail: "Settled. This is not an invoice.",
        },
        figures,
        budget,
      }
    case "RESERVED":
      return {
        completeness: cost.completeness,
        headline: {
          label: "Cost",
          amount: usd(cost.reservedUsd),
          detail: "Budget held, not yet settled. This is not an invoice.",
        },
        figures,
        budget,
      }
    case "UNRESOLVED":
      return {
        completeness: cost.completeness,
        headline: {
          label: "Cost",
          // Deliberately no amount: an unresolved cost has no figure that can
          // stand for it, and showing one would be a measured claim.
          amount: null,
          detail:
            "Pending reconciliation. An amount exists but is not yet attributable, so no total can be shown.",
        },
        figures,
        budget,
      }
    case "NOT_APPLICABLE":
      return {
        completeness: cost.completeness,
        headline: {
          label: "Cost",
          amount: null,
          detail: "No paid work has contributed to this import.",
        },
        figures,
        budget,
      }
    default: {
      const exhaustive: never = cost.completeness
      throw new Error(`unhandled cost completeness: ${String(exhaustive)}`)
    }
  }
}

export const costCompletenessLabel = (completeness: CostCompleteness): string => {
  switch (completeness) {
    case "MEASURED":
      return "Measured"
    case "RESERVED":
      return "Reserved"
    case "UNRESOLVED":
      return "Unresolved"
    case "NOT_APPLICABLE":
      return "Not applicable"
    default: {
      const exhaustive: never = completeness
      throw new Error(`unhandled cost completeness: ${String(exhaustive)}`)
    }
  }
}

export type ProgressCount = {
  readonly label: string
  readonly value: number
  readonly detail: string
}

/**
 * The nine counters the contract publishes, in two groups.
 *
 * `BF-004` asks for "processed / total", and the contract publishes neither
 * field. The relationship it supports is completed and failed work against
 * what discovery found, so that is what is stated, and it is stated as the
 * derivation it is rather than as a figure the backend sent.
 */
export const progressCounts = (
  counts: RepositoryImport["counts"],
): {
  readonly work: readonly ProgressCount[]
  readonly summary: string
} => ({
  work: [
    {
      label: "Discovered",
      value: counts.discovered,
      detail: "Pull requests discovery found in the requested window.",
    },
    {
      label: "Skipped",
      value: counts.skipped,
      detail: "Already held, so no work was created for them.",
    },
    {
      label: "Enqueued",
      value: counts.enqueued,
      detail: "Accepted for processing.",
    },
    {
      label: "Source ready",
      value: counts.sourceReady,
      detail: "Source prepared and ready for extraction.",
    },
    {
      label: "Completed",
      value: counts.completed,
      detail: "Finished with a recorded outcome.",
    },
    {
      label: "Failed",
      value: counts.failed,
      detail: "Did not finish. This is infrastructure failure, not a model decision.",
    },
  ],
  summary: `${counts.completed} completed and ${counts.failed} failed of ${counts.discovered} discovered`,
})

/**
 * The three machine outcomes, which are not failures and not Knowledge Objects.
 *
 * Rejected is a valid model decision and quarantined is invalid model output.
 * Neither ever enters trusted memory, and neither is an infrastructure problem,
 * so they are reported apart from the failed count.
 */
export const dispositionCounts = (
  dispositions: RepositoryImport["dispositions"],
): readonly ProgressCount[] => [
  {
    label: "Accepted",
    value: dispositions.accepted,
    detail: "Admitted as trusted Engineering Memory.",
  },
  {
    label: "Rejected",
    value: dispositions.rejected,
    detail:
      "The model found nothing to record. A valid decision, and never a Knowledge Object.",
  },
  {
    label: "Quarantined",
    value: dispositions.quarantined,
    detail:
      "The model returned output that failed validation. Held for inspection, and never a Knowledge Object.",
  },
]
