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
      // A registry canonical identifier, which is what the catalogue offers
      // and what the worker presents at the paid boundary.
      allowedModelProfiles: ["anthropic-claude-sonnet-4"],
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
    ...overrides.processing,
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
    ...overrides.engineeringMemory,
  },
})

const modelProfile = (
  canonicalIdentifier,
  provider,
  modelId,
  offeringState,
  availability,
  namedByActiveConsent,
) => ({
  canonicalIdentifier,
  provider,
  modelId,
  offeringState,
  availability,
  namedByActiveConsent,
})

/**
 * The catalogue an `AUTO_EXTRACT` consent may name.
 *
 * The identifier is the registry's and is never composed from provider and
 * model. `acme/analytics` consents to `anthropic-claude-sonnet-4`, so the
 * default catalogue marks that one as named by an active consent.
 */
export const MODEL_PROFILES = () => ({
  organizationId: ORGANIZATION,
  modelProfiles: [
    modelProfile(
      "anthropic-claude-sonnet-4",
      "anthropic",
      "claude-sonnet-4",
      "AVAILABLE",
      "OFFERED",
      true,
    ),
    modelProfile("openai-gpt-5", "openai", "gpt-5", "AVAILABLE", "OFFERED", false),
    modelProfile(
      "openai-gpt-5-mini",
      "openai",
      "gpt-5-mini",
      "DEPRECATED",
      "OFFERED",
      false,
    ),
    // Withdrawn and named by nobody: simply not offered, and not surfaced.
    modelProfile(
      "anthropic-claude-haiku-3",
      "anthropic",
      "claude-haiku-3",
      "RETIRED",
      "NO_LONGER_OFFERED",
      false,
    ),
  ],
})

/**
 * The same catalogue where a live consent names a profile that was withdrawn.
 *
 * Withdrawing an offer does not revoke consent, so this pairs
 * `NO_LONGER_OFFERED` with `namedByActiveConsent`, which is the combination the
 * Console must render as its own state.
 */
export const MODEL_PROFILES_WITH_RETIRED = () => ({
  organizationId: ORGANIZATION,
  modelProfiles: [
    modelProfile("openai-gpt-5", "openai", "gpt-5", "AVAILABLE", "OFFERED", false),
    modelProfile(
      "anthropic-claude-sonnet-4",
      "anthropic",
      "claude-sonnet-4",
      "RETIRED",
      "NO_LONGER_OFFERED",
      true,
    ),
  ],
})

/** An organization offered nothing at all: a fact, not a failure. */
export const MODEL_PROFILES_EMPTY = () => ({
  organizationId: ORGANIZATION,
  modelProfiles: [],
})

/** One overview per repository the inventory carries. */
export const OVERVIEWS = () =>
  Object.fromEntries(
    baseRepositories().map((repository) => [
      repository.id,
      repositoryOverview(repository.id, repository.nameWithOwner),
    ]),
  )

export const KNOWLEDGE = {
  pending: "00000000-0000-4000-8000-000000000201",
  approved: "00000000-0000-4000-8000-000000000202",
  edited: "00000000-0000-4000-8000-000000000203",
  userRejected: "00000000-0000-4000-8000-000000000204",
  active: "00000000-0000-4000-8000-000000000205",
  superseded: "00000000-0000-4000-8000-000000000206",
  superseding: "00000000-0000-4000-8000-000000000207",
  withdrawn: "00000000-0000-4000-8000-000000000208",
  machineRejected: "00000000-0000-4000-8000-000000000209",
  machineQuarantined: "00000000-0000-4000-8000-00000000020a",
  correctionOpen: "00000000-0000-4000-8000-00000000020b",
}

/** A three-link supersession chain, for the traversal bound and for cycles. */
export const KNOWLEDGE_CHAIN = {
  first: "00000000-0000-4000-8000-000000000211",
  second: "00000000-0000-4000-8000-000000000212",
  third: "00000000-0000-4000-8000-000000000213",
  fourth: "00000000-0000-4000-8000-000000000214",
}

/**
 * Owned by the other tenant, one per identifier kind the surface accepts.
 *
 * None is ever served. The refusal must be identical whether an identifier
 * belongs to another organization or to nothing at all, or the response itself
 * discloses existence.
 */
export const FOREIGN_KNOWLEDGE = {
  knowledgeObject: "00000000-0000-4000-8000-0000000002f1",
  evidence: "00000000-0000-4000-8000-0000000002f2",
  review: "00000000-0000-4000-8000-0000000002f3",
  relation: "00000000-0000-4000-8000-0000000002f4",
  correction: "00000000-0000-4000-8000-0000000002f5",
}

const hex = (seed) => seed.repeat(64).slice(0, 64)

const ORIGINAL_SHA = hex("a")
const EDITED_SHA = hex("b")
const EDIT_SCHEMA_SHA = hex("c")
const PIPELINE_SHA = hex("d")

const PULL_REQUESTS = {
  review: "00000000-0000-4000-8000-000000000301",
  lifecycle: "00000000-0000-4000-8000-000000000302",
}

const REVIEWER = "00000000-0000-4000-8000-00000000c001"
const KNOWLEDGE_REPOSITORY = REPOSITORIES.activeSourceOnly

/** The thirteen editable keys, which `REV-002` requires in full on every edit. */
const editablePayload = (overrides = {}) => ({
  affectedSystems: ["console", "extraction"],
  answerableQuestions: ["Can a recorded review be amended?"],
  constraints: ["Reviews are append-only"],
  designRationale: "A mutable row would lose the decision it replaced.",
  documentedTradeoffs: ["More rows to read"],
  explicitAlternatives: ["A mutable current-state column"],
  failureModes: ["A silently discarded decision"],
  futureImpact: "The audit trail stays complete.",
  implementationStatus: "implemented",
  invariants: ["The review sequence is monotonic"],
  knowledge: "Every review decision is appended, never updated.",
  knowledgeType: "ArchitectureDecision",
  problem: "Updating a review in place destroys the prior decision.",
  ...overrides,
})

const evidenceItem = (evidenceId, ordinal, quote) => ({
  author: "octocat",
  evidenceId,
  ordinal,
  quote,
  source: "pull request review comment",
  sourceId: PULL_REQUESTS.review,
  sourceType: "pull_request_review_comment",
  sourceUrl: "https://github.com/acme/payments-api/pull/412",
})

export const EVIDENCE_IDS = {
  first: "00000000-0000-4000-8000-000000000401",
  second: "00000000-0000-4000-8000-000000000402",
  unlinked: "00000000-0000-4000-8000-000000000403",
}

const defaultEvidence = () => [
  evidenceItem(
    EVIDENCE_IDS.first,
    1,
    "We append a review row rather than updating the one before it.",
  ),
  evidenceItem(
    EVIDENCE_IDS.second,
    2,
    "The effective decision is the highest sequence, never the latest timestamp.",
  ),
]

const review = (sequence, action, decision, overrides = {}) => ({
  acknowledgedEvidenceIds: [EVIDENCE_IDS.first],
  action,
  decision,
  observedLifecycleState: "UNRESOLVED",
  observedLifecycleVersion: 0,
  originalPayloadSha256: ORIGINAL_SHA,
  recordedAt: `2026-08-${String(10 + sequence).padStart(2, "0")}T09:00:00Z`,
  reviewId: `00000000-0000-4000-8000-${String(500 + sequence).padStart(12, "0")}`,
  reviewSequence: sequence,
  reviewerRole: "owner",
  reviewerUserId: REVIEWER,
  ...overrides,
})

const approveReview = (sequence) => review(sequence, "APPROVE", "APPROVED")

const editReview = (sequence, issueSeverity, overrides = {}) =>
  review(sequence, "EDIT", "EDITED", {
    editSchemaSha256: EDIT_SCHEMA_SHA,
    editSchemaVersion: "1",
    editedPayload: editablePayload(overrides),
    editedPayloadSha256: EDITED_SHA,
    issueSeverity,
  })

const rejectReview = (sequence, rejectReasonCode, issueSeverity, note) =>
  review(sequence, "USER_REJECT", "USER_REJECTED", {
    rejectReasonCode,
    issueSeverity,
    ...(note === undefined ? {} : { note }),
  })

/**
 * One append-only history carrying every published reject reason.
 *
 * A reviewer who rejects, reconsiders and rejects again for a different reason
 * is exactly what `12.1` permits, and it is the only shape that reaches all
 * seven reason codes without inventing a transition the matrix forbids. It
 * doubles as the long timeline the history surface has to render.
 */
const reconsideredHistory = () => [
  rejectReview(1, "INCORRECT", "CRITICAL"),
  approveReview(2),
  rejectReview(3, "UNSUPPORTED", "MINOR"),
  approveReview(4),
  rejectReview(5, "TOO_VAGUE", "NONE"),
  approveReview(6),
  rejectReview(7, "DUPLICATE", "MAJOR"),
  approveReview(8),
  rejectReview(9, "OUTDATED", "MINOR"),
  approveReview(10),
  rejectReview(11, "OTHER", "MAJOR", "Superseded by the decision in PR 480."),
  approveReview(12),
  rejectReview(13, "NOT_DURABLE", "MINOR"),
]

const technicalDetails = (overrides = {}) => ({
  admissionDecisionOrigin: "MODEL",
  admissionDisposition: "ACCEPTED",
  componentVersions: { admission: "2.4.0", extractor: "3.1.0" },
  cost: {
    completeness: "MEASURED",
    measuredUsd: "0.042000",
    reservedUsd: "0.000000",
    unresolvedUsd: "0.000000",
  },
  effectiveJobId: "00000000-0000-4000-8000-000000000601",
  extractedAt: "2026-08-09T18:20:00Z",
  extractionRunId: "00000000-0000-4000-8000-000000000602",
  latencyMs: 4120,
  resolvedModelId: "evirion-extraction-standard",
  semanticPipelineFingerprint: PIPELINE_SHA,
  tokenUsage: { completion: 812, prompt: 6140 },
  validationValid: true,
  ...overrides,
})

const sourceContext = (overrides = {}) => ({
  mergedAt: "2026-08-08T14:30:00Z",
  nameWithOwner: "acme/payments-api",
  pullRequestAuthorLogin: "octocat",
  pullRequestId: PULL_REQUESTS.review,
  pullRequestNumber: 412,
  pullRequestTitle: "Make knowledge review append-only",
  pullRequestUrl: "https://github.com/acme/payments-api/pull/412",
  repositoryId: KNOWLEDGE_REPOSITORY,
  ...overrides,
})

/**
 * One stored Knowledge Object.
 *
 * The projections the API publishes are derived from this by the server, not
 * stored beside it, so review sequence stays `reviews.length` and `PENDING`
 * stays the absence of a review rather than a value a fixture could contradict.
 */
const knowledgeObject = (knowledgeObjectId, shortClaim, overrides = {}) => ({
  base: {
    author: "octocat",
    confidence: 82,
    createdAt: "2026-08-09T18:25:00Z",
    implementationStatus: "implemented",
    knowledge: "Every review decision is appended, never updated.",
    knowledgeObjectId,
    knowledgeStatus: "current",
    knowledgeType: "ArchitectureDecision",
    knowledgeValue: "high",
    memoryPriority: 70,
    originalPayload: editablePayload(),
    problem: "Updating a review in place destroys the prior decision.",
    sourceContext: sourceContext(),
    technicalDetails: technicalDetails(),
  },
  shortClaim,
  evidence: defaultEvidence(),
  reviews: [],
  lifecycleState: "UNRESOLVED",
  lifecycleVersion: 0,
  supersededBy: [],
  supersedes: [],
  corrections: [],
  repositoryId: KNOWLEDGE_REPOSITORY,
  ...overrides,
})

const relation = (knowledgeRelationId, knowledgeObjectId, relationState, version) => ({
  knowledgeObjectId,
  knowledgeRelationId,
  relationState,
  relationVersion: version,
})

export const RELATIONS = {
  superseding: "00000000-0000-4000-8000-000000000701",
  retracted: "00000000-0000-4000-8000-000000000702",
  chainFirst: "00000000-0000-4000-8000-000000000703",
  chainSecond: "00000000-0000-4000-8000-000000000704",
  chainThird: "00000000-0000-4000-8000-000000000705",
}

export const CORRECTIONS = {
  requested: "00000000-0000-4000-8000-000000000801",
  executing: "00000000-0000-4000-8000-000000000802",
  executed: "00000000-0000-4000-8000-000000000803",
  failed: "00000000-0000-4000-8000-000000000804",
  rejected: "00000000-0000-4000-8000-000000000805",
}

const correctionHistoryEntry = (toStatus, requestVersion, overrides = {}) => ({
  actorKind: toStatus === "REQUESTED" ? "customer" : "platform_operator",
  recordedAt: `2026-08-2${requestVersion}T11:00:00Z`,
  requestVersion,
  toStatus,
  ...overrides,
})

/**
 * One durable correction request.
 *
 * `history` is append-only and carries both actor kinds: the customer creates
 * the request and a platform operator moves it. Nothing here names the
 * operator, their decision rationale beyond the published reason, or any
 * internal failure detail.
 */
const correction = (correctionRequestId, status, overrides = {}) => ({
  attemptCount: 1,
  correctionRequestId,
  history: [correctionHistoryEntry("REQUESTED", 1)],
  knowledgeObjectId: KNOWLEDGE.correctionOpen,
  reasonCode: "SUPERSESSION_ERRONEOUS",
  requestType: "RETRACT_SUPERSESSION",
  requestVersion: 1,
  requestedAt: "2026-08-21T11:00:00Z",
  requestedByRole: "owner",
  requestedByUserId: REVIEWER,
  requestedLifecycleVersion: 1,
  requestedReviewSequence: 1,
  status,
  ...overrides,
})

/**
 * Every published correction status, request type, reason code and
 * compensating lifecycle state, on one object's request list.
 */
const correctionCatalogue = () => [
  correction(CORRECTIONS.requested, "REQUESTED", {
    knowledgeRelationId: RELATIONS.superseding,
    requestedRelationVersion: 1,
  }),
  correction(CORRECTIONS.executing, "EXECUTING", {
    requestType: "WITHDRAW_ACTIVE_KNOWLEDGE",
    reasonCode: "KNOWLEDGE_NO_LONGER_TRUE",
    requestVersion: 2,
    compensatingLifecycleState: "WITHDRAWN",
    updatedAt: "2026-08-22T11:00:00Z",
    history: [
      correctionHistoryEntry("REQUESTED", 1),
      correctionHistoryEntry("EXECUTING", 2, { fromStatus: "REQUESTED" }),
    ],
  }),
  correction(CORRECTIONS.executed, "EXECUTED", {
    requestType: "RESTORE_UNRESOLVED",
    reasonCode: "KNOWLEDGE_MISATTRIBUTED",
    requestVersion: 3,
    compensatingLifecycleState: "UNRESOLVED",
    updatedAt: "2026-08-23T11:00:00Z",
    history: [
      correctionHistoryEntry("REQUESTED", 1),
      correctionHistoryEntry("EXECUTING", 2, { fromStatus: "REQUESTED" }),
      correctionHistoryEntry("EXECUTED", 3, { fromStatus: "EXECUTING" }),
    ],
  }),
  correction(CORRECTIONS.failed, "FAILED", {
    reasonCode: "OTHER",
    note: "The supersession named the wrong replacement.",
    requestVersion: 2,
    attemptCount: 2,
    // A published code and nothing else. No operator internal reaches here.
    failureCode: "DEPENDENCY_UNAVAILABLE",
    compensatingLifecycleState: "ACTIVE",
    knowledgeRelationId: RELATIONS.retracted,
    requestedRelationVersion: 2,
    updatedAt: "2026-08-24T11:00:00Z",
    history: [
      correctionHistoryEntry("REQUESTED", 1),
      correctionHistoryEntry("EXECUTING", 2, { fromStatus: "REQUESTED" }),
      correctionHistoryEntry("FAILED", 2, { fromStatus: "EXECUTING" }),
    ],
  }),
  correction(CORRECTIONS.rejected, "REJECTED", {
    requestVersion: 2,
    updatedAt: "2026-08-25T11:00:00Z",
    history: [
      correctionHistoryEntry("REQUESTED", 1),
      correctionHistoryEntry("REJECTED", 2, {
        fromStatus: "REQUESTED",
        reason: "The supersession is correct as recorded.",
      }),
    ],
  }),
]

/**
 * The knowledge inventory, keyed by identifier.
 *
 * It covers every published review decision and lifecycle state, both
 * admission outcomes that are not Knowledge Objects, and a supersession chain
 * long enough to exhaust the traversal bound.
 */
export const KNOWLEDGE_OBJECTS = () => {
  const objects = {
    [KNOWLEDGE.pending]: knowledgeObject(
      KNOWLEDGE.pending,
      "Review decisions are appended, never updated.",
    ),
    [KNOWLEDGE.approved]: knowledgeObject(
      KNOWLEDGE.approved,
      "The effective review is the highest sequence.",
      { reviews: [approveReview(1)] },
    ),
    [KNOWLEDGE.edited]: knowledgeObject(
      KNOWLEDGE.edited,
      "An edit is a derivative of the machine extraction.",
      {
        reviews: [
          rejectReview(1, "INCORRECT", "CRITICAL"),
          approveReview(2),
          editReview(3, "MINOR", { knowledge: "An edit never replaces the original." }),
          review(4, "REVERT_TO_ORIGINAL_AND_APPROVE", "APPROVED"),
          editReview(5, "NONE", {
            knowledge: "The reviewer restated the claim in the team's own words.",
          }),
        ],
      },
    ),
    [KNOWLEDGE.userRejected]: knowledgeObject(
      KNOWLEDGE.userRejected,
      "A rejected object keeps its provenance and its history.",
      { reviews: reconsideredHistory() },
    ),
    [KNOWLEDGE.active]: knowledgeObject(
      KNOWLEDGE.active,
      "Activation is a lifecycle event, not a review decision.",
      { reviews: [approveReview(1)], lifecycleState: "ACTIVE", lifecycleVersion: 1 },
    ),
    [KNOWLEDGE.superseding]: knowledgeObject(
      KNOWLEDGE.superseding,
      "The newer claim that replaces the retry-budget decision.",
      {
        reviews: [approveReview(1)],
        // It supersedes two objects: one live relation, and one an operator
        // retracted after the customer asked for a correction.
        supersedes: [
          relation(RELATIONS.superseding, KNOWLEDGE.superseded, "ACTIVE", 1),
          relation(RELATIONS.retracted, KNOWLEDGE.correctionOpen, "RETRACTED", 2),
        ],
        base: {
          ...knowledgeObject(KNOWLEDGE.superseding, "").base,
          sourceContext: sourceContext({
            pullRequestId: PULL_REQUESTS.lifecycle,
            pullRequestNumber: 480,
            pullRequestTitle: "Replace the retry budget decision",
          }),
        },
      },
    ),
    [KNOWLEDGE.superseded]: knowledgeObject(
      KNOWLEDGE.superseded,
      "The retry budget decision that a newer claim replaced.",
      {
        reviews: [approveReview(1)],
        lifecycleState: "SUPERSEDED",
        lifecycleVersion: 1,
        supersededBy: [
          relation(RELATIONS.superseding, KNOWLEDGE.superseding, "ACTIVE", 1),
        ],
      },
    ),
    [KNOWLEDGE.withdrawn]: knowledgeObject(
      KNOWLEDGE.withdrawn,
      "An internally withdrawn claim, which is not a reviewer action.",
      {
        reviews: [approveReview(1)],
        lifecycleState: "WITHDRAWN",
        lifecycleVersion: 2,
      },
    ),
    [KNOWLEDGE.correctionOpen]: knowledgeObject(
      KNOWLEDGE.correctionOpen,
      "A claim whose supersession the customer asked Evirion to retract.",
      {
        reviews: [approveReview(1)],
        lifecycleState: "SUPERSEDED",
        lifecycleVersion: 1,
        supersededBy: [
          relation(RELATIONS.retracted, KNOWLEDGE.superseding, "RETRACTED", 2),
        ],
        corrections: correctionCatalogue(),
      },
    ),
    // Neither of the next two is a Knowledge Object. They are legitimate
    // machine outcomes that produced no knowledge, and no surface may render
    // one as trusted, so the queue never lists them and the detail refuses.
    [KNOWLEDGE.machineRejected]: knowledgeObject(
      KNOWLEDGE.machineRejected,
      "A machine-rejected extraction that must never appear as knowledge.",
      {
        base: {
          ...knowledgeObject(KNOWLEDGE.machineRejected, "").base,
          technicalDetails: technicalDetails({
            admissionDecisionOrigin: "DETERMINISTIC_POLICY",
            admissionDisposition: "REJECTED",
            cost: {
              completeness: "NOT_APPLICABLE",
              measuredUsd: "0.000000",
              reservedUsd: "0.000000",
              unresolvedUsd: "0.000000",
            },
          }),
        },
      },
    ),
    [KNOWLEDGE.machineQuarantined]: knowledgeObject(
      KNOWLEDGE.machineQuarantined,
      "A quarantined extraction that must never appear as knowledge.",
      {
        base: {
          ...knowledgeObject(KNOWLEDGE.machineQuarantined, "").base,
          technicalDetails: technicalDetails({
            admissionDecisionOrigin: "VALIDATION",
            admissionDisposition: "QUARANTINED",
            validationValid: false,
            cost: {
              completeness: "UNRESOLVED",
              measuredUsd: "0.000000",
              reservedUsd: "0.010000",
              unresolvedUsd: "0.010000",
            },
          }),
        },
      },
    ),
  }

  // The chain: fourth supersedes third supersedes second supersedes first.
  // Superseding `fourth` by `first` would close the cycle, and reaching from
  // one end to the other exhausts a bound of three.
  const chain = [
    [KNOWLEDGE_CHAIN.first, KNOWLEDGE_CHAIN.second, RELATIONS.chainFirst],
    [KNOWLEDGE_CHAIN.second, KNOWLEDGE_CHAIN.third, RELATIONS.chainSecond],
    [KNOWLEDGE_CHAIN.third, KNOWLEDGE_CHAIN.fourth, RELATIONS.chainThird],
  ]

  for (const [index, id] of Object.values(KNOWLEDGE_CHAIN).entries()) {
    objects[id] = knowledgeObject(id, `Chain link ${index + 1}.`, {
      reviews: [approveReview(1)],
      lifecycleState: index === 3 ? "UNRESOLVED" : "SUPERSEDED",
      lifecycleVersion: index === 3 ? 0 : 1,
      base: {
        ...knowledgeObject(id, "").base,
        // The chain has no cost figure at all, which is `NOT_APPLICABLE` and
        // never zero.
        technicalDetails: technicalDetails({
          cost: {
            completeness: "RESERVED",
            measuredUsd: "0.000000",
            reservedUsd: "0.025000",
            unresolvedUsd: "0.000000",
          },
        }),
      },
    })
  }

  for (const [older, newer, relationId] of chain) {
    objects[older].supersededBy = [relation(relationId, newer, "ACTIVE", 1)]
    objects[newer].supersedes = [relation(relationId, older, "ACTIVE", 1)]
  }

  return objects
}

/** A connected organization with the repository the knowledge inventory cites. */
const withKnowledge = () => ({
  repositories: baseRepositories(),
  limit: {
    maxActiveRepositories: 5,
    mode: "FIXED",
    replacementMode: "SELF_SERVICE",
  },
  installation: installationConnected(),
  pageSize: 50,
  knowledgePageSize: 50,
})

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

  /** A live consent names a profile the organization may no longer pick. */
  retiredModelProfile: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 5,
      mode: "FIXED",
      replacementMode: "SELF_SERVICE",
    },
    installation: installationConnected(),
    pageSize: 50,
    modelProfiles: MODEL_PROFILES_WITH_RETIRED(),
  }),

  /** Nothing is offered, so there is nothing to consent to. */
  noModelProfiles: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 5,
      mode: "FIXED",
      replacementMode: "SELF_SERVICE",
    },
    installation: installationConnected(),
    pageSize: 50,
    modelProfiles: MODEL_PROFILES_EMPTY(),
  }),

  /** The catalogue cannot be read, so no consent may be offered at all. */
  modelProfilesUnavailable: () => ({
    repositories: baseRepositories(),
    limit: {
      maxActiveRepositories: 5,
      mode: "FIXED",
      replacementMode: "SELF_SERVICE",
    },
    installation: installationConnected(),
    pageSize: 50,
    modelProfilesError: "DEPENDENCY_UNAVAILABLE",
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

  /**
   * The whole knowledge inventory: every review decision, every lifecycle
   * state, both admission outcomes that are not Knowledge Objects, every
   * correction status, and a supersession chain long enough to exhaust the
   * traversal bound.
   */
  memory: () => ({ ...withKnowledge(), knowledge: KNOWLEDGE_OBJECTS() }),

  /** No admitted knowledge yet, which is the empty state and not a refusal. */
  memoryEmpty: () => withKnowledge(),

  /** The queue cannot be read. Nothing may render as an empty result. */
  memoryUnavailable: () => ({
    ...withKnowledge(),
    knowledge: KNOWLEDGE_OBJECTS(),
    knowledgeError: "DEPENDENCY_UNAVAILABLE",
  }),

  /** Two rows per page, so the cursor control is exercised. */
  memoryPaged: () => ({
    ...withKnowledge(),
    knowledge: KNOWLEDGE_OBJECTS(),
    knowledgePageSize: 2,
  }),

  /**
   * Evidence cannot be read. `KD-002` requires the attribution to be visible
   * before a review action, so the surface must say it does not know rather
   * than render an object with no supporting quote.
   */
  memoryEvidenceUnavailable: () => ({
    ...withKnowledge(),
    knowledge: KNOWLEDGE_OBJECTS(),
    evidenceError: "DEPENDENCY_UNAVAILABLE",
  }),

  /**
   * A lifecycle state the contract does not publish.
   *
   * The value is injected at the response rather than stored in the shared
   * inventory, because the coverage assertions require that inventory to hold
   * exactly the published set. Every route must fail closed on a response like
   * this rather than render a partial document.
   */
  memoryUnsupported: () => ({
    ...withKnowledge(),
    knowledge: KNOWLEDGE_OBJECTS(),
    knowledgeUnsupported: true,
  }),

  /**
   * Contract-legal detail responses with an optional block absent.
   *
   * `review` is optional, and it is the only source of `allowedActions`.
   * `editedPayload` is optional, so the backend can say an object is edited
   * and give nothing to render. Every other scenario derives both
   * consistently, which is exactly why these two shapes went untested.
   */
  memoryPartialProjection: () => ({
    ...withKnowledge(),
    knowledge: KNOWLEDGE_OBJECTS(),
    knowledgeWithoutReview: KNOWLEDGE.pending,
    knowledgeWithoutEditedPayload: KNOWLEDGE.edited,
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
