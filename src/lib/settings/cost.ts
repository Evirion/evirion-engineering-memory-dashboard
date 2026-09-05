import type {
  OrganizationMetrics,
  OrganizationUsage,
  ProcessingPage,
} from "@contracts/console"

/**
 * Cost amount and completeness, always together when present.
 *
 * Nothing here decides anything. Completeness arrives from the backend and is
 * rendered without inferring an amount from it, so reserved and unresolved
 * figures never read as a measured zero and nothing here is an invoice.
 */

export type CostCompleteness = ProcessingPage["items"][number]["cost"] extends infer C
  ? C extends { completeness: infer K }
    ? K
    : never
  : never

export type CostBlock = NonNullable<ProcessingPage["items"][number]["cost"]>

export type UsageCostBlock = OrganizationUsage["cost"]

export type MetricsRateCost = OrganizationMetrics["admission"]["costPerPullRequest"]

export type CostFigure = {
  readonly label: string
  readonly amount: string | null
  readonly detail: string
}

export type CostView = {
  readonly completeness: CostCompleteness
  readonly headline: CostFigure
  readonly figures: readonly CostFigure[]
}

const usd = (amount: string): string => `USD ${amount}`

const figuresFor = (
  measuredUsd: string,
  reservedUsd: string,
  unresolvedUsd: string,
): readonly CostFigure[] => [
  {
    label: "Measured",
    amount: usd(measuredUsd),
    detail: "Settled and attributed to this period or job.",
  },
  {
    label: "Reserved",
    amount: usd(reservedUsd),
    detail: "Held and not yet settled.",
  },
  {
    label: "Unresolved",
    amount: usd(unresolvedUsd),
    detail: "Recorded but not yet attributable.",
  },
]

export const costViewFromBlock = (cost: CostBlock | UsageCostBlock): CostView => {
  const figures = figuresFor(cost.measuredUsd, cost.reservedUsd, cost.unresolvedUsd)

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
      }
    case "RESERVED":
      return {
        completeness: cost.completeness,
        headline: {
          label: "Cost",
          amount: usd(cost.reservedUsd),
          detail: "Reserved against the budget and not yet settled.",
        },
        figures,
      }
    case "UNRESOLVED":
      return {
        completeness: cost.completeness,
        headline: {
          label: "Cost",
          amount: null,
          detail: "Cost is pending reconciliation and cannot be shown as a figure yet.",
        },
        figures,
      }
    case "NOT_APPLICABLE":
      return {
        completeness: cost.completeness,
        headline: {
          label: "Cost",
          amount: null,
          detail: "No cost applies to this row.",
        },
        figures,
      }
    case "UNSUPPORTED_SERVER_RESPONSE":
      return {
        completeness: cost.completeness,
        headline: {
          label: "Cost",
          amount: null,
          detail: "Cost completeness is in an unsupported state.",
        },
        figures,
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
      return "Settled"
    case "RESERVED":
      return "Reserved, not settled"
    case "UNRESOLVED":
      return "Pending reconciliation"
    case "NOT_APPLICABLE":
      return "Not applicable"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported"
    default: {
      const exhaustive: never = completeness
      throw new Error(`unhandled cost completeness: ${String(exhaustive)}`)
    }
  }
}

export const metricsRateCostLabel = (cost: MetricsRateCost): string => {
  switch (cost.completeness) {
    case "MEASURED":
      return cost.measuredUsd === null
        ? "Unavailable"
        : `${usd(cost.measuredUsd)}, settled`
    case "RESERVED":
      return "Reserved, not settled"
    case "UNRESOLVED":
      return "Pending reconciliation"
    case "NOT_APPLICABLE":
      return "Not applicable"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported"
    default: {
      const exhaustive: never = cost.completeness
      throw new Error(`unhandled cost completeness: ${String(exhaustive)}`)
    }
  }
}

export const rateLabel = (rate: number | null, denominator: number): string => {
  if (denominator === 0 || rate === null) return "Unavailable"
  return `${(rate * 100).toFixed(1)}%`
}
