import type {
  OrganizationModelProfiles,
  Repository,
  RepositoryOverview,
  RepositoryPage,
} from "@contracts/console"

/**
 * How a repository reads on screen.
 *
 * Access, entitlement and policy are three independent axes. A repository can
 * be GitHub-accessible and not entitled, entitled and operator-locked, or
 * entitled with policy `OFF`, so collapsing them into one status chip makes an
 * unresolvable support question. Each axis gets its own labelled slot with its
 * own text value, which is also what `NFR-ACC-001` means by a status indicator
 * that does not depend on colour.
 *
 * Nothing here decides anything. Entitlement source, capacity, replacement
 * mode, generation and operator decisions all arrive from the backend and are
 * only rendered.
 *
 * The wording below is neutral text derived from the contract's own vocabulary.
 * It is not approved product copy: open decision 3 owns the customer-facing
 * wording and is recorded in `docs/architecture/console-ui-conventions.md`.
 */

export type RepositoryAxis = {
  /** The axis itself, so the reader can tell which question is answered. */
  readonly label: string
  /** The answer, always as text so it never depends on colour alone. */
  readonly value: string
  readonly detail: string
  /**
   * An axis the customer cannot act on is not a failure. Operator-managed and
   * locked are legitimate resting states and must not render as errors.
   */
  readonly tone: "neutral" | "attention"
}

export type OrganizationLimit = RepositoryPage["summary"]["limit"]

export type OverviewCounter = {
  readonly key: string
  readonly label: string
  readonly value: number
}

export type OverviewGroup = {
  readonly id: "processing" | "engineering-memory"
  readonly heading: string
  readonly note: string
  readonly counters: readonly OverviewCounter[]
}

/**
 * Both label tables are keyed by the published field set, so a counter the
 * backend adds fails the build here instead of being dropped from the page.
 * Their declaration order is the render order, which is why they are read with
 * `Object.entries` rather than paired with a separate ordering array that could
 * silently omit one.
 */
const PROCESSING_LABELS: Readonly<
  Record<keyof RepositoryOverview["processing"], string>
> = {
  mergedPullRequestsDiscovered: "Merged pull requests discovered",
  sourceEnvelopesPrepared: "Source envelopes prepared",
  awaitingApproval: "Awaiting approval",
  processing: "Processing now",
  completedRuns: "Completed runs",
  rejectedRuns: "Runs the model rejected",
  quarantinedRuns: "Runs quarantined as invalid",
  failedJobs: "Failed jobs",
}

const MEMORY_LABELS: Readonly<
  Record<keyof RepositoryOverview["engineeringMemory"], string>
> = {
  admittedKnowledgeObjects: "Knowledge Objects admitted",
  awaitingReview: "Awaiting review",
  approved: "Approved by a reviewer",
  edited: "Edited by a reviewer",
  userRejected: "Rejected by a reviewer",
  unresolved: "Unresolved",
  active: "Active",
  superseded: "Superseded",
  withdrawn: "Withdrawn",
}

export type ModelProfileChoice = {
  readonly canonicalIdentifier: string
  /** Provider and model, because an identifier alone is not a product name. */
  readonly label: string
  readonly offeringState: OrganizationModelProfiles["modelProfiles"][number]["offeringState"]
}

type CataloguedProfile = OrganizationModelProfiles["modelProfiles"][number]

const asChoice = (profile: CataloguedProfile): ModelProfileChoice => ({
  canonicalIdentifier: profile.canonicalIdentifier,
  label: `${profile.provider} ${profile.modelId}`,
  offeringState: profile.offeringState,
})

/**
 * What the organization may name in a new consent.
 *
 * The canonical identifier is the registry's, never composed here from provider
 * and model: composing it is exactly the defect backend issue #54 recorded,
 * where the two ends disagreed on the format and no consent could ever match.
 */
export const offeredProfiles = (
  catalogue: OrganizationModelProfiles,
): readonly ModelProfileChoice[] =>
  catalogue.modelProfiles
    .filter((profile) => profile.availability === "OFFERED")
    .map(asChoice)

/**
 * Profiles a live consent names that the organization may no longer pick.
 *
 * Withdrawing an offer does not revoke a consent already given, so this is a
 * state the backend can produce and the customer cannot resolve alone. A
 * withdrawn profile no consent names is not surfaced: it is simply not offered.
 */
export const retiredNamedByConsent = (
  catalogue: OrganizationModelProfiles,
): readonly ModelProfileChoice[] =>
  catalogue.modelProfiles
    .filter(
      (profile) =>
        profile.availability === "NO_LONGER_OFFERED" && profile.namedByActiveConsent,
    )
    .map(asChoice)

const counters = (
  labels: Readonly<Record<string, string>>,
  values: Readonly<Record<string, number>>,
): readonly OverviewCounter[] =>
  Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: values[key] as number,
  }))

/**
 * The counters, split the way the contract splits them.
 *
 * A rejected or quarantined run is a legitimate machine outcome, not an
 * infrastructure failure and not a Knowledge Object, so it stays in the
 * processing group and never near the admitted count.
 */
export const overviewGroups = (
  overview: RepositoryOverview,
): readonly OverviewGroup[] => [
  {
    id: "processing",
    heading: "Processing",
    note:
      "Rejected and quarantined runs are decisions about the source work, not " +
      "failures, and they never become Knowledge Objects.",
    counters: counters(PROCESSING_LABELS, overview.processing),
  },
  {
    id: "engineering-memory",
    heading: "Engineering Memory",
    note:
      "Only admitted Knowledge Objects are counted here. Review and lifecycle " +
      "are separate axes, so an object appears under both.",
    counters: counters(MEMORY_LABELS, overview.engineeringMemory),
  },
]

export const accessAxis = (repository: Repository): RepositoryAxis => {
  if (repository.archived) {
    return {
      label: "GitHub access",
      value: "Archived",
      detail: "GitHub reports this repository as archived.",
      tone: "neutral",
    }
  }

  // `access` is optional in the contract, so the coarse flag is the fallback
  // rather than an assumption that the detail block is always present.
  const status =
    repository.access?.status ?? (repository.accessible ? "ACCESSIBLE" : "INACCESSIBLE")

  if (status === "INACCESSIBLE") {
    return {
      label: "GitHub access",
      value: "Not accessible",
      detail:
        "The installation no longer exposes this repository. Reconnect or adjust the installation on GitHub.",
      tone: "attention",
    }
  }

  const lastSeen = repository.access?.lastSuccessfulSyncAt
  return {
    label: "GitHub access",
    value: "Accessible",
    detail: lastSeen
      ? `Confirmed by the last completed synchronization on ${lastSeen}.`
      : "Confirmed by the installation.",
    tone: "neutral",
  }
}

export const entitlementAxis = (repository: Repository): RepositoryAxis => {
  const entitlement = repository.entitlement

  if (entitlement === null) {
    return {
      label: "Evirion entitlement",
      value: "Not activated",
      detail:
        "GitHub access alone never activates a repository. Nothing is read from it.",
      tone: "neutral",
    }
  }

  if (entitlement.state === "DISABLED") {
    return {
      label: "Evirion entitlement",
      value: "Disabled",
      detail:
        "New work is blocked. Everything already recorded for this repository is kept.",
      tone: "neutral",
    }
  }

  return {
    label: "Evirion entitlement",
    value: "Active",
    detail: `Granted as ${entitlementSourceLabel(entitlement.source)}.`,
    tone: "neutral",
  }
}

export const policyAxis = (repository: Repository): RepositoryAxis => {
  if (repository.policy === null) {
    return {
      label: "Live processing",
      value: "None",
      detail: "A processing policy exists only once the repository is activated.",
      tone: "neutral",
    }
  }

  switch (repository.policy.mode) {
    case "OFF":
      return {
        label: "Live processing",
        value: "Off",
        detail: "A newly merged pull request creates no source work and no model call.",
        tone: "neutral",
      }
    case "SOURCE_ONLY":
      return {
        label: "Live processing",
        value: "Source only",
        detail:
          "A newly merged pull request is prepared as source work. No model call is authorized.",
        tone: "neutral",
      }
    case "AUTO_EXTRACT":
      return {
        label: "Live processing",
        value: "Automatic extraction",
        detail:
          "Your consent is recorded. Evirion operational authorization is still required before any model call.",
        tone: "neutral",
      }
    default: {
      const exhaustive: never = repository.policy.mode
      throw new Error(`unhandled policy mode: ${String(exhaustive)}`)
    }
  }
}

export const entitlementSourceLabel = (
  source: NonNullable<Repository["entitlement"]>["source"],
): string => {
  switch (source) {
    case "DESIGN_PARTNER":
      return "a design partner slot"
    case "PLAN":
      return "a plan allocation"
    case "MANUAL":
      return "an Evirion operator exception"
    default: {
      const exhaustive: never = source
      throw new Error(`unhandled entitlement source: ${String(exhaustive)}`)
    }
  }
}

/**
 * The single-line summary the backend already computed. It is shown beside the
 * three axes, never instead of them.
 */
export const productStateLabel = (state: Repository["productState"]): string => {
  switch (state) {
    case "ARCHIVED":
      return "Archived"
    case "INACCESSIBLE":
      return "Not accessible"
    case "AVAILABLE_LOCKED":
      return "Available, not activated"
    case "ENTITLEMENT_DISABLED":
      return "Entitlement disabled"
    case "ACTIVE_LIVE_OFF":
      return "Active, live processing off"
    case "ACTIVE_SOURCE_ONLY":
      return "Active, source only"
    case "ACTIVE_AUTO_EXTRACT":
      return "Active, automatic extraction"
    case "CHANGE_REQUESTED":
      return "Change requested"
    default: {
      const exhaustive: never = state
      throw new Error(`unhandled product state: ${String(exhaustive)}`)
    }
  }
}

export type RepositoryControls = {
  readonly canActivate: boolean
  readonly canDisable: boolean
  readonly canRequestChange: boolean
  readonly canChangePolicy: boolean
  /**
   * True when the organization's replacement mode reserves the decision for an
   * Evirion operator. It is a state, not a failure, and not an error message.
   */
  readonly operatorManaged: boolean
}

const has = (capabilities: readonly string[], capability: string): boolean =>
  capabilities.includes(capability)

/**
 * Which controls to render.
 *
 * This is presentation only. Hiding a control is a convenience and never an
 * authorization: the backend refuses the same request regardless, and every
 * refusal path is rendered even for a control that is also hidden.
 */
export const repositoryControls = (
  repository: Repository,
  limit: OrganizationLimit,
  capabilities: readonly string[],
): RepositoryControls => {
  const manageEntitlement = has(capabilities, "repository.entitlements.manage")
  const managePolicy = has(capabilities, "repository.policy.manage")
  const active = repository.entitlement?.state === "ACTIVE"
  // A missing limit row is operator-managed rather than self-service; the
  // backend refuses activation with ORGANIZATION_LIMIT_NOT_PROVISIONED.
  const operatorManaged = limit === null || limit.replacementMode === "OPERATOR_ONLY"
  const changeAlreadyRequested = repository.changeRequest !== null

  return {
    canActivate:
      manageEntitlement &&
      !active &&
      repository.accessible &&
      !repository.archived &&
      limit !== null,
    canDisable: manageEntitlement && active && !operatorManaged,
    canRequestChange:
      manageEntitlement && active && operatorManaged && !changeAlreadyRequested,
    canChangePolicy: managePolicy && active,
    operatorManaged,
  }
}

/** Capacity as the backend reports it. The UI never computes a slot decision. */
export const capacitySummary = (
  summary: RepositoryPage["summary"],
): { readonly value: string; readonly detail: string } => {
  if (summary.limit === null) {
    return {
      value: `${summary.activeRepositories} active`,
      detail:
        "No repository allowance is provisioned for this organization yet. Contact Evirion.",
    }
  }

  if (summary.limit.mode === "UNLIMITED") {
    return {
      value: `${summary.activeRepositories} active`,
      detail: "This organization has no fixed repository allowance.",
    }
  }

  return {
    value: `${summary.activeRepositories} of ${summary.limit.maxActiveRepositories ?? 0} active`,
    detail:
      summary.limit.replacementMode === "OPERATOR_ONLY"
        ? "Replacing an activated repository is an Evirion operator action."
        : "You can activate and disable repositories within this allowance.",
  }
}
