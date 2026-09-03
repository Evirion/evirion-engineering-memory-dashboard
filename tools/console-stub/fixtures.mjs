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

/**
 * One import identifier per published run state.
 *
 * A repository has at most one current import, so covering eight statuses, six
 * authorization states and four cost states takes one named run each and a
 * scenario that attaches it. The contract test fails if any published member
 * has no fixture.
 */
export const IMPORTS = {
  resumeBlocked: "00000000-0000-4000-8000-000000009010",
  planning: "00000000-0000-4000-8000-000000009001",
  discovering: "00000000-0000-4000-8000-000000009002",
  awaitingApproval: "00000000-0000-4000-8000-000000009003",
  awaitingAuthorization: "00000000-0000-4000-8000-000000009004",
  processing: "00000000-0000-4000-8000-000000009005",
  paused: "00000000-0000-4000-8000-000000009006",
  completed: "00000000-0000-4000-8000-000000009007",
  failed: "00000000-0000-4000-8000-000000009008",
  cancelled: "00000000-0000-4000-8000-000000009009",
}

export const EXTRACTION_JOBS = {
  retryable: "00000000-0000-4000-8000-00000000a001",
  blocked: "00000000-0000-4000-8000-00000000a002",
}

/** The repository every import fixture is attached to. */
const IMPORTED_REPOSITORY = REPOSITORIES.activeSourceOnly

const importRun = (overrides) => ({
  capabilities: {
    canApprove: false,
    canCancel: false,
    canPause: false,
    canResume: false,
  },
  cost: {
    budgetUsd: null,
    completeness: "NOT_APPLICABLE",
    measuredUsd: "0.000000",
    reservedUsd: "0.000000",
    unresolvedUsd: "0.000000",
  },
  counts: {
    completed: 0,
    discovered: 0,
    enqueued: 0,
    failed: 0,
    skipped: 0,
    sourceReady: 0,
  },
  createdAt: "2026-09-01T10:00:00Z",
  dispositions: { accepted: 0, quarantined: 0, rejected: 0 },
  filters: {},
  highWatermark: "2026-09-01T10:00:00Z",
  missingPrerequisite: null,
  mode: "MISSING_ONLY",
  modelCallsApproved: false,
  paidAuthorizationStatus: "NOT_REQUIRED",
  recoveryAction: "NONE",
  repositoryId: IMPORTED_REPOSITORY,
  terminationReasonCategory: null,
  updatedAt: "2026-09-01T10:05:00Z",
  ...overrides,
})

export const IMPORT_RUNS = {
  /** Free stages only: nothing paid applies, so no consent state exists yet. */
  planning: () => importRun({ importId: IMPORTS.planning, status: "PLANNING" }),

  discovering: () =>
    importRun({
      importId: IMPORTS.discovering,
      status: "DISCOVERING",
      counts: {
        completed: 0,
        discovered: 12,
        enqueued: 0,
        failed: 0,
        skipped: 3,
        sourceReady: 0,
      },
      capabilities: {
        canApprove: false,
        canCancel: true,
        canPause: false,
        canResume: false,
      },
      recoveryAction: "AWAIT_DISCOVERY",
    }),

  /** The one authorization state with something for the customer to do. */
  awaitingApproval: () =>
    importRun({
      importId: IMPORTS.awaitingApproval,
      status: "AWAITING_APPROVAL",
      capabilities: {
        canApprove: true,
        canCancel: true,
        canPause: false,
        canResume: false,
      },
      counts: {
        completed: 0,
        discovered: 24,
        enqueued: 21,
        failed: 0,
        skipped: 3,
        sourceReady: 21,
      },
      filters: { mergedFrom: "2026-01-01T00:00:00Z", mergedTo: "2026-06-30T23:59:59Z" },
      missingPrerequisite: "CUSTOMER_CONSENT",
      paidAuthorizationStatus: "AWAITING_CUSTOMER_CONSENT",
      recoveryAction: "APPROVE_IMPORT",
    }),

  /**
   * The wait the customer cannot end. The run is processing and consent is
   * recorded, so a surface that read status alone would say "Extracting".
   */
  awaitingAuthorization: () =>
    importRun({
      importId: IMPORTS.awaitingAuthorization,
      status: "PROCESSING",
      capabilities: {
        canApprove: false,
        canCancel: true,
        canPause: true,
        canResume: false,
      },
      cost: {
        budgetUsd: "30.000000",
        completeness: "RESERVED",
        measuredUsd: "0.000000",
        reservedUsd: "6.250000",
        unresolvedUsd: "0.000000",
      },
      counts: {
        completed: 0,
        discovered: 24,
        enqueued: 21,
        failed: 0,
        skipped: 3,
        sourceReady: 21,
      },
      missingPrerequisite: "OPERATIONAL_AUTHORIZATION",
      modelCallsApproved: true,
      paidAuthorizationStatus: "AWAITING_OPERATIONAL_AUTHORIZATION",
      recoveryAction: "AWAIT_EVIRION_AUTHORIZATION",
    }),

  processing: () =>
    importRun({
      importId: IMPORTS.processing,
      status: "PROCESSING",
      capabilities: {
        canApprove: false,
        canCancel: true,
        canPause: true,
        canResume: false,
      },
      cost: {
        budgetUsd: "30.000000",
        completeness: "RESERVED",
        measuredUsd: "2.100000",
        reservedUsd: "9.400000",
        unresolvedUsd: "0.000000",
      },
      counts: {
        completed: 9,
        discovered: 24,
        enqueued: 21,
        failed: 0,
        skipped: 3,
        sourceReady: 21,
      },
      dispositions: { accepted: 7, quarantined: 1, rejected: 1 },
      modelCallsApproved: true,
      paidAuthorizationStatus: "AUTHORIZED",
    }),

  /** Expired authorization: a fresh request is the customer's to make. */
  paused: () =>
    importRun({
      importId: IMPORTS.paused,
      status: "PAUSED",
      capabilities: {
        canApprove: true,
        canCancel: true,
        canPause: false,
        canResume: true,
      },
      cost: {
        budgetUsd: "30.000000",
        completeness: "RESERVED",
        measuredUsd: "4.000000",
        reservedUsd: "5.000000",
        unresolvedUsd: "0.000000",
      },
      counts: {
        completed: 12,
        discovered: 24,
        enqueued: 21,
        failed: 0,
        skipped: 3,
        sourceReady: 21,
      },
      dispositions: { accepted: 10, quarantined: 1, rejected: 1 },
      modelCallsApproved: true,
      paidAuthorizationStatus: "EXPIRED",
      recoveryAction: "APPROVE_IMPORT",
    }),

  completed: () =>
    importRun({
      importId: IMPORTS.completed,
      status: "COMPLETED",
      cost: {
        budgetUsd: "30.000000",
        completeness: "MEASURED",
        measuredUsd: "18.400000",
        reservedUsd: "0.000000",
        unresolvedUsd: "0.000000",
      },
      counts: {
        completed: 21,
        discovered: 24,
        enqueued: 21,
        failed: 0,
        skipped: 3,
        sourceReady: 21,
      },
      dispositions: { accepted: 17, quarantined: 2, rejected: 2 },
      modelCallsApproved: true,
      paidAuthorizationStatus: "AUTHORIZED",
    }),

  /** Unresolved cost beside failed work, which is where a zero would lie. */
  failed: () =>
    importRun({
      importId: IMPORTS.failed,
      status: "FAILED",
      cost: {
        budgetUsd: "30.000000",
        completeness: "UNRESOLVED",
        measuredUsd: "3.000000",
        reservedUsd: "0.000000",
        unresolvedUsd: "1.750000",
      },
      counts: {
        completed: 16,
        discovered: 24,
        enqueued: 21,
        failed: 2,
        skipped: 3,
        sourceReady: 21,
      },
      dispositions: { accepted: 14, quarantined: 1, rejected: 1 },
      modelCallsApproved: true,
      paidAuthorizationStatus: "AUTHORIZED",
      recoveryAction: "RETRY_JOB",
    }),

  /**
   * Paused with source work still held back, so a resume is forced back to
   * paused. That answer is a completed command with its own response code, and
   * the surface has to be able to explain it rather than call it unknown.
   */
  resumeBlocked: () =>
    importRun({
      importId: IMPORTS.resumeBlocked,
      status: "PAUSED",
      capabilities: {
        canApprove: false,
        canCancel: true,
        canPause: false,
        canResume: true,
      },
      cost: {
        budgetUsd: "30.000000",
        completeness: "RESERVED",
        measuredUsd: "5.000000",
        reservedUsd: "3.000000",
        unresolvedUsd: "0.000000",
      },
      counts: {
        completed: 14,
        discovered: 24,
        enqueued: 21,
        failed: 2,
        skipped: 3,
        sourceReady: 21,
      },
      dispositions: { accepted: 12, quarantined: 1, rejected: 1 },
      modelCallsApproved: true,
      paidAuthorizationStatus: "AUTHORIZED",
      recoveryAction: "RETRY_JOB",
    }),

  cancelled: () =>
    importRun({
      importId: IMPORTS.cancelled,
      status: "CANCELLED",
      cost: {
        budgetUsd: "30.000000",
        completeness: "MEASURED",
        measuredUsd: "1.200000",
        reservedUsd: "0.000000",
        unresolvedUsd: "0.000000",
      },
      counts: {
        completed: 2,
        discovered: 24,
        enqueued: 21,
        failed: 0,
        skipped: 3,
        sourceReady: 21,
      },
      dispositions: { accepted: 2, quarantined: 0, rejected: 0 },
      paidAuthorizationStatus: "REVOKED",
      recoveryAction: "CONTACT_SUPPORT",
      terminationReasonCategory: "OPERATOR_REVOCATION",
    }),
}

/**
 * Failed work for the failed run.
 *
 * One entry the backend declares retryable and one it blocks, so the surface
 * has to read the projection rather than infer a control from the failure.
 */
const failedWork = (first, second) => [
  {
    extractionJobId: EXTRACTION_JOBS.retryable,
    itemId: first,
    lastErrorCode: "SOURCE_FETCH_FAILED",
    pullRequestNumber: 118,
    recoveryAction: "RETRY_JOB",
    retryBlocker: null,
    retryable: true,
    status: "FAILED",
    updatedAt: "2026-09-01T11:00:00Z",
  },
  {
    extractionJobId: EXTRACTION_JOBS.blocked,
    itemId: second,
    lastErrorCode: "PROVIDER_OUTCOME_UNKNOWN",
    pullRequestNumber: 119,
    recoveryAction: "CONTACT_SUPPORT",
    retryBlocker: "REPOSITORY_IMPORT_JOB_NOT_RETRYABLE",
    retryable: false,
    status: "FAILED",
    updatedAt: "2026-09-01T11:05:00Z",
  },
]

export const IMPORT_FAILURES = () => ({
  [IMPORTS.resumeBlocked]: failedWork("51", "52"),
  [IMPORTS.failed]: [
    {
      extractionJobId: EXTRACTION_JOBS.retryable,
      itemId: "41",
      lastErrorCode: "SOURCE_FETCH_FAILED",
      pullRequestNumber: 118,
      recoveryAction: "RETRY_JOB",
      retryBlocker: null,
      retryable: true,
      status: "FAILED",
      updatedAt: "2026-09-01T11:00:00Z",
    },
    {
      extractionJobId: EXTRACTION_JOBS.blocked,
      itemId: "42",
      lastErrorCode: "PROVIDER_OUTCOME_UNKNOWN",
      pullRequestNumber: 119,
      recoveryAction: "CONTACT_SUPPORT",
      retryBlocker: "REPOSITORY_IMPORT_JOB_NOT_RETRYABLE",
      retryable: false,
      status: "FAILED",
      updatedAt: "2026-09-01T11:05:00Z",
    },
  ],
})

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
 * Counters for one repository at one cutoff.
 *
 * Every counter is required by the schema, so there is no "unavailable" value
 * to fixture. A backend that cannot compute one produces a document the
 * validator refuses, which the `overviewError` scenario drives instead.
 */
const repositoryOverview = (repositoryId, nameWithOwner, overrides = {}) => ({
  repositoryId,
  nameWithOwner,
  asOf: "2026-09-02T18:33:41.123456Z",
  processing: {
    mergedPullRequestsDiscovered: 12,
    sourceEnvelopesPrepared: 12,
    awaitingApproval: 1,
    processing: 2,
    completedRuns: 8,
    rejectedRuns: 1,
    // A real zero, so the browser gate can tell a genuine count of none from a
    // blank and from an unavailable aggregate rendered as zero.
    quarantinedRuns: 0,
    failedJobs: 0,
    ...(overrides.processing ?? {}),
  },
  engineeringMemory: {
    admittedKnowledgeObjects: 30,
    awaitingReview: 4,
    approved: 22,
    edited: 3,
    userRejected: 1,
    unresolved: 0,
    active: 25,
    superseded: 4,
    withdrawn: 1,
    ...(overrides.engineeringMemory ?? {}),
  },
})

/** One overview per repository the inventory carries. */
export const OVERVIEWS = () =>
  Object.fromEntries(
    baseRepositories().map((repository) => [
      repository.id,
      repositoryOverview(repository.id, repository.nameWithOwner),
    ]),
  )

/** A connected organization whose one active repository carries `run`. */
const withImport = (run) => ({
  repositories: baseRepositories(),
  limit: {
    maxActiveRepositories: 5,
    mode: "FIXED",
    replacementMode: "SELF_SERVICE",
  },
  installation: installationConnected(),
  pageSize: 50,
  imports: { [IMPORTED_REPOSITORY]: run() },
  importFailures: IMPORT_FAILURES(),
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

  /**
   * The counters cannot be read. The rest of the repository page must stay
   * fully usable, and nothing may appear as zero.
   */
  overviewUnavailable: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 5,
      mode: "FIXED",
      replacementMode: "SELF_SERVICE",
    },
    installation: installationConnected(),
    pageSize: 50,
    overviewError: "DEPENDENCY_UNAVAILABLE",
  }),

  /** No import prepared yet, which is the empty state and not a refusal. */
  importAbsent: () => ({ ...withImport(IMPORT_RUNS.planning), imports: {} }),

  importPlanning: () => withImport(IMPORT_RUNS.planning),
  importDiscovering: () => withImport(IMPORT_RUNS.discovering),
  /** The one authorization state that gives the customer something to do. */
  importAwaitingApproval: () => withImport(IMPORT_RUNS.awaitingApproval),
  /** Processing, consent recorded, and still waiting on Evirion. */
  importAwaitingAuthorization: () => withImport(IMPORT_RUNS.awaitingAuthorization),
  importProcessing: () => withImport(IMPORT_RUNS.processing),
  /** Paused with an expired authorization, so a fresh request is offered. */
  importPaused: () => withImport(IMPORT_RUNS.paused),
  importCompleted: () => withImport(IMPORT_RUNS.completed),
  /** Failed work beside an unresolved cost, which is where a zero would lie. */
  importFailed: () => withImport(IMPORT_RUNS.failed),
  /** Cancelled by an operator revocation, with authorization revoked. */
  importCancelled: () => withImport(IMPORT_RUNS.cancelled),
  /** Paused with held-back source work, so resuming is forced back to paused. */
  importResumeBlocked: () => withImport(IMPORT_RUNS.resumeBlocked),
}
