// Contract-shaped fixtures for the browser gate.
//
// These are evaluation artifacts, never runtime inputs. Every value here must
// satisfy the generated validators in generated/console-contract/v1, because
// the Console fails closed on anything it cannot validate and a lenient
// fixture would prove nothing.
//
// The capability arrays are the exact ones the backend projects for each role
// at the pinned contract source commit. Short names such as `github.manage` do
// not exist and must not be invented here.

export const ORGANIZATION = "00000000-0000-4000-8000-0000000000a1"
export const FOREIGN_ORGANIZATION = "00000000-0000-4000-8000-0000000000b1"

export const REPOSITORIES = {
  archived: "00000000-0000-4000-8000-000000000001",
  inaccessible: "00000000-0000-4000-8000-000000000002",
  availableLocked: "00000000-0000-4000-8000-000000000003",
  entitlementDisabled: "00000000-0000-4000-8000-000000000004",
  activeLiveOff: "00000000-0000-4000-8000-000000000005",
  activeSourceOnly: "00000000-0000-4000-8000-000000000006",
  activeAutoExtract: "00000000-0000-4000-8000-000000000007",
  changeRequested: "00000000-0000-4000-8000-000000000008",
}

/**
 * Owned by the other tenant. It is deliberately never served: the refusal must
 * be identical whether the identifier belongs to another organization or to
 * nothing at all, or the response itself discloses existence.
 */
export const FOREIGN_REPOSITORY = "00000000-0000-4000-8000-0000000000f1"

export const CAPABILITIES = {
  owner: [
    "knowledge.lifecycle.manage",
    "knowledge.read",
    "knowledge.review",
    "organization.github.manage",
    "organization.members.manage",
    "organization.members.read",
    "organization.offboarding.request",
    "organization.ownership.transfer",
    "organization.read",
    "organization.usage.read",
    "processing.read",
    "repository.entitlements.manage",
    "repository.policy.manage",
    "session.manage",
  ],
  viewer: [
    "knowledge.read",
    "organization.members.read",
    "organization.read",
    "processing.read",
    "session.manage",
  ],
}

/**
 * Bearer token to principal. The Console forwards the caller token unchanged
 * and never supplies an organization claim, so this is the only tenant source.
 */
export const PRINCIPALS = {
  "console-stub-owner": {
    actorId: "00000000-0000-4000-8000-00000000c001",
    organizationId: ORGANIZATION,
    role: "owner",
    sessionId: "00000000-0000-4000-8000-00000000d001",
  },
  "console-stub-viewer": {
    actorId: "00000000-0000-4000-8000-00000000c002",
    organizationId: ORGANIZATION,
    role: "viewer",
    sessionId: "00000000-0000-4000-8000-00000000d002",
  },
  "console-stub-foreign-owner": {
    actorId: "00000000-0000-4000-8000-00000000c003",
    organizationId: FOREIGN_ORGANIZATION,
    role: "owner",
    sessionId: "00000000-0000-4000-8000-00000000d003",
  },
}

const accessible = (lastSuccessfulSyncAt = "2026-09-01T09:00:00Z") => ({
  lastSeenSyncGeneration: 7,
  lastSuccessfulSyncAt,
  status: "ACCESSIBLE",
})

/** One repository per published `productState`, so no state is untested. */
const baseRepositories = () => [
  {
    id: REPOSITORIES.archived,
    nameWithOwner: "acme/legacy-tooling",
    archived: true,
    accessible: true,
    access: accessible(),
    productState: "ARCHIVED",
    entitlement: null,
    policy: null,
    effectiveConsent: null,
    changeRequest: null,
  },
  {
    id: REPOSITORIES.inaccessible,
    nameWithOwner: "acme/removed-service",
    archived: false,
    accessible: false,
    access: {
      lastSeenSyncGeneration: 6,
      lastSuccessfulSyncAt: "2026-08-30T09:00:00Z",
      status: "INACCESSIBLE",
    },
    productState: "INACCESSIBLE",
    entitlement: null,
    policy: null,
    effectiveConsent: null,
    changeRequest: null,
  },
  {
    id: REPOSITORIES.availableLocked,
    nameWithOwner: "acme/payments",
    archived: false,
    accessible: true,
    access: accessible(),
    productState: "AVAILABLE_LOCKED",
    entitlement: null,
    policy: null,
    effectiveConsent: null,
    changeRequest: null,
  },
  {
    id: REPOSITORIES.entitlementDisabled,
    nameWithOwner: "acme/billing",
    archived: false,
    accessible: true,
    access: accessible(),
    productState: "ENTITLEMENT_DISABLED",
    entitlement: {
      generation: 3,
      source: "DESIGN_PARTNER",
      state: "DISABLED",
      version: 4,
    },
    policy: { mode: "OFF", version: 2 },
    effectiveConsent: null,
    changeRequest: null,
  },
  {
    id: REPOSITORIES.activeLiveOff,
    nameWithOwner: "acme/identity",
    archived: false,
    accessible: true,
    access: accessible(),
    productState: "ACTIVE_LIVE_OFF",
    entitlement: {
      generation: 1,
      source: "DESIGN_PARTNER",
      state: "ACTIVE",
      version: 1,
    },
    policy: { mode: "OFF", version: 1 },
    effectiveConsent: null,
    changeRequest: null,
  },
  {
    id: REPOSITORIES.activeSourceOnly,
    nameWithOwner: "acme/console",
    archived: false,
    accessible: true,
    access: accessible(),
    productState: "ACTIVE_SOURCE_ONLY",
    entitlement: {
      generation: 1,
      source: "DESIGN_PARTNER",
      state: "ACTIVE",
      version: 2,
    },
    policy: { mode: "SOURCE_ONLY", version: 3 },
    effectiveConsent: null,
    changeRequest: null,
  },
  {
    id: REPOSITORIES.activeAutoExtract,
    nameWithOwner: "acme/extraction",
    archived: false,
    accessible: true,
    access: accessible(),
    productState: "ACTIVE_AUTO_EXTRACT",
    entitlement: {
      generation: 2,
      source: "MANUAL",
      state: "ACTIVE",
      version: 5,
    },
    policy: { mode: "AUTO_EXTRACT", version: 6 },
    effectiveConsent: {
      allowedModelProfiles: ["standard-extraction"],
      budgetCeilingUsd: "40.000000",
      callCeiling: 250,
      expiresAt: "2026-12-31T23:59:59Z",
      retryPolicy: "BOUNDED_TRANSPORT_RETRY",
      scope: "LIVE_REPOSITORY",
    },
    changeRequest: null,
  },
  {
    id: REPOSITORIES.changeRequested,
    nameWithOwner: "acme/search",
    archived: false,
    accessible: true,
    access: accessible(),
    productState: "CHANGE_REQUESTED",
    entitlement: {
      generation: 1,
      source: "DESIGN_PARTNER",
      state: "ACTIVE",
      version: 2,
    },
    policy: { mode: "SOURCE_ONLY", version: 1 },
    effectiveConsent: null,
    changeRequest: {
      id: "00000000-0000-4000-8000-00000000e001",
      requestedRepositoryId: REPOSITORIES.availableLocked,
      state: "REQUESTED",
      version: 1,
    },
  },
]

const installationConnected = () => ({
  installation: {
    accountLogin: "acme",
    connectedAt: "2026-08-28T08:00:00Z",
    id: "00000000-0000-4000-8000-00000000e101",
    status: "ACTIVE",
  },
  latestSyncRun: {
    attemptCount: 1,
    failureCode: null,
    generation: 7,
    id: "00000000-0000-4000-8000-00000000e201",
    progress: {
      pagesApplied: 3,
      repositoriesMarkedInaccessible: 1,
      repositoriesSeen: 8,
    },
    requestedAt: "2026-09-01T08:55:00Z",
    resolvedAt: "2026-09-01T09:00:00Z",
    startedAt: "2026-08-31T08:56:00Z",
    status: "COMPLETED",
    version: 4,
  },
  organizationId: ORGANIZATION,
  repositorySummary: { accessibleRepositories: 7, inaccessibleRepositories: 1 },
  setupIntent: null,
})

/**
 * The named states the browser gate drives. A scenario is loaded through the
 * control endpoint before the browser is pointed at the Console.
 */
export const SCENARIOS = {
  /** Every published product state, with one slot free of a capacity of five. */
  default: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 5,
      mode: "FIXED",
      replacementMode: "SELF_SERVICE",
    },
    installation: installationConnected(),
    pageSize: 50,
  }),

  /** Capacity is consumed, so activating anything further must be refused. */
  limitReached: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 4,
      mode: "FIXED",
      replacementMode: "SELF_SERVICE",
    },
    installation: installationConnected(),
    pageSize: 50,
  }),

  /** No accessible repository at all: the empty state, not an error. */
  empty: () => ({
    repositories: [],
    limit: {
      maxActiveRepositories: 1,
      mode: "FIXED",
      replacementMode: "OPERATOR_ONLY",
    },
    installation: {
      ...installationConnected(),
      latestSyncRun: null,
      repositorySummary: { accessibleRepositories: 0, inaccessibleRepositories: 0 },
    },
    pageSize: 50,
  }),

  /** Limited Alpha: capacity consumed and replacement owned by the operator. */
  operatorOnly: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 4,
      mode: "FIXED",
      replacementMode: "OPERATOR_ONLY",
    },
    installation: installationConnected(),
    pageSize: 50,
  }),

  /** The organization program was never provisioned. Every read fails closed. */
  limitNotProvisioned: () => ({
    repositories: baseRepositories(),
    limit: null,
    listError: "ORGANIZATION_LIMIT_NOT_PROVISIONED",
    installation: installationConnected(),
    pageSize: 50,
  }),

  /** No installation yet: the connect journey starts here. */
  notConnected: () => ({
    repositories: [],
    limit: {
      maxActiveRepositories: 1,
      mode: "FIXED",
      replacementMode: "OPERATOR_ONLY",
    },
    installation: {
      installation: null,
      latestSyncRun: null,
      organizationId: ORGANIZATION,
      repositorySummary: { accessibleRepositories: 0, inaccessibleRepositories: 0 },
      setupIntent: null,
    },
    pageSize: 50,
  }),

  /** A traversal still running: access removal must not be inferred from it. */
  syncRunning: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 4,
      mode: "FIXED",
      replacementMode: "SELF_SERVICE",
    },
    installation: {
      ...installationConnected(),
      latestSyncRun: {
        attemptCount: 1,
        failureCode: null,
        generation: 8,
        id: "00000000-0000-4000-8000-00000000e202",
        progress: {
          pagesApplied: 1,
          repositoriesMarkedInaccessible: 0,
          repositoriesSeen: 3,
        },
        requestedAt: "2026-09-02T08:55:00Z",
        resolvedAt: null,
        startedAt: "2026-09-02T08:56:00Z",
        status: "RUNNING",
        version: 1,
      },
    },
    pageSize: 50,
  }),

  /** A suspended installation blocks new source work and needs a reconnect. */
  installationSuspended: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 4,
      mode: "FIXED",
      replacementMode: "SELF_SERVICE",
    },
    installation: {
      ...installationConnected(),
      installation: {
        accountLogin: "acme",
        connectedAt: "2026-08-28T08:00:00Z",
        id: "00000000-0000-4000-8000-00000000e101",
        status: "SUSPENDED",
      },
    },
    pageSize: 50,
  }),

  /** Two repositories per page, so the cursor control is exercised. */
  paged: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 4,
      mode: "FIXED",
      replacementMode: "SELF_SERVICE",
    },
    installation: installationConnected(),
    pageSize: 2,
  }),

  /** An unlimited organization, where a customer disable is permitted. */
  unlimited: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: null,
      mode: "UNLIMITED",
      replacementMode: "SELF_SERVICE",
    },
    installation: installationConnected(),
    pageSize: 50,
  }),
}
