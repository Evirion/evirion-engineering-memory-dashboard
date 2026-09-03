import type {
  GithubInstallation,
  KnowledgeCorrections,
  KnowledgeDetail,
  KnowledgeEvidence,
  KnowledgeLifecycleState,
  KnowledgeRelationEdge,
  KnowledgeReview,
  OrganizationModelProfiles,
  Repository,
  RepositoryImport,
  RepositoryImportFailures,
  RepositoryOverview,
  RepositoryPage,
} from "@contracts/console"

/**
 * Types for the browser-gate fixtures.
 *
 * They are declared against the generated contract types rather than against
 * whatever the fixture happens to contain, so a fixture that drifts from the
 * contract fails to compile before it fails a runtime validator.
 */

export declare const ORGANIZATION: string
export declare const FOREIGN_ORGANIZATION: string
export declare const FOREIGN_REPOSITORY: string

export declare const REPOSITORIES: {
  readonly archived: string
  readonly inaccessible: string
  readonly availableLocked: string
  readonly entitlementDisabled: string
  readonly activeLiveOff: string
  readonly activeSourceOnly: string
  readonly activeAutoExtract: string
  readonly changeRequested: string
}

export declare const IMPORTS: {
  readonly resumeBlocked: string
  readonly planning: string
  readonly discovering: string
  readonly awaitingApproval: string
  readonly awaitingAuthorization: string
  readonly processing: string
  readonly paused: string
  readonly completed: string
  readonly failed: string
  readonly cancelled: string
}

export declare const EXTRACTION_JOBS: {
  readonly retryable: string
  readonly blocked: string
}

export declare const IMPORT_RUNS: Readonly<
  Record<keyof typeof IMPORTS, () => RepositoryImport>
>

export declare const IMPORT_FAILURES: () => Readonly<
  Record<string, RepositoryImportFailures["failures"]>
>

/** One overview per repository in the inventory, keyed by repository id. */
export declare const OVERVIEWS: () => Readonly<Record<string, RepositoryOverview>>

export declare const MODEL_PROFILES: () => OrganizationModelProfiles
export declare const MODEL_PROFILES_WITH_RETIRED: () => OrganizationModelProfiles
export declare const MODEL_PROFILES_EMPTY: () => OrganizationModelProfiles

export declare const CAPABILITIES: {
  readonly owner: readonly string[]
  readonly viewer: readonly string[]
}

export declare const PRINCIPALS: Readonly<
  Record<
    string,
    {
      readonly actorId: string
      readonly organizationId: string
      readonly role: "owner" | "admin" | "reviewer" | "viewer"
      readonly sessionId: string
    }
  >
>

export declare const KNOWLEDGE: {
  readonly pending: string
  readonly approved: string
  readonly edited: string
  readonly userRejected: string
  readonly active: string
  readonly superseded: string
  readonly superseding: string
  readonly withdrawn: string
  readonly machineRejected: string
  readonly machineQuarantined: string
  readonly correctionOpen: string
}

export declare const KNOWLEDGE_CHAIN: {
  readonly first: string
  readonly second: string
  readonly third: string
  readonly fourth: string
}

/** One per identifier kind the knowledge surface accepts. None is ever served. */
export declare const FOREIGN_KNOWLEDGE: {
  readonly knowledgeObject: string
  readonly evidence: string
  readonly review: string
  readonly relation: string
  readonly correction: string
}

export declare const EVIDENCE_IDS: {
  readonly first: string
  readonly second: string
  readonly unlinked: string
}

export declare const RELATIONS: {
  readonly superseding: string
  readonly retracted: string
  readonly chainFirst: string
  readonly chainSecond: string
  readonly chainThird: string
}

export declare const CORRECTIONS: {
  readonly requested: string
  readonly executing: string
  readonly executed: string
  readonly rejected: string
  readonly failed: string
}

/**
 * One stored Knowledge Object.
 *
 * The published projections are derived from this by the server rather than
 * stored beside it, so review sequence stays the row count and `PENDING` stays
 * the absence of a review rather than a value a fixture could contradict.
 */
export type StubKnowledgeObject = {
  base: Omit<KnowledgeDetail, "humanEdited" | "lifecycle" | "review">
  shortClaim: string
  evidence: KnowledgeEvidence["evidence"]
  reviews: KnowledgeReview[]
  lifecycleState: KnowledgeLifecycleState["lifecycleState"]
  lifecycleVersion: number
  supersededBy: KnowledgeRelationEdge[]
  supersedes: KnowledgeRelationEdge[]
  corrections: KnowledgeCorrections["correctionRequests"]
  repositoryId: string
}

export declare const KNOWLEDGE_OBJECTS: () => Record<string, StubKnowledgeObject>

export type StubScenario = {
  readonly repositories: Repository[]
  readonly limit: RepositoryPage["summary"]["limit"]
  readonly installation: GithubInstallation
  readonly pageSize: number
  /** A published stable code the repository list answers with instead. */
  readonly listError?: string
  /** The one current import per repository, keyed by repository identifier. */
  readonly imports?: Readonly<Record<string, RepositoryImport>>
  /** Failed work per import identifier. */
  readonly importFailures?: Readonly<
    Record<string, RepositoryImportFailures["failures"]>
  >
  /** Counters per repository. Absent means the server serves `OVERVIEWS()`. */
  readonly overviews?: Readonly<Record<string, RepositoryOverview>>
  /** A published stable code the overview read answers with instead. */
  readonly overviewError?: string
  /** The consent catalogue. Absent means the server serves `MODEL_PROFILES()`. */
  readonly modelProfiles?: OrganizationModelProfiles
  /** A published stable code the catalogue read answers with instead. */
  readonly modelProfilesError?: string
  /** The knowledge inventory, keyed by identifier. Absent means an empty queue. */
  readonly knowledge?: Readonly<Record<string, StubKnowledgeObject>>
  readonly knowledgePageSize?: number
  /** A published stable code the review queue answers with instead. */
  readonly knowledgeError?: string
  /** A published stable code the evidence read answers with instead. */
  readonly evidenceError?: string
}

/**
 * Enumerated rather than indexed by an open string, so a scenario name that
 * does not exist fails to compile instead of resolving to `undefined`.
 */
export declare const SCENARIOS: {
  readonly default: () => StubScenario
  readonly limitReached: () => StubScenario
  readonly empty: () => StubScenario
  readonly operatorOnly: () => StubScenario
  readonly limitNotProvisioned: () => StubScenario
  readonly notConnected: () => StubScenario
  readonly syncRunning: () => StubScenario
  readonly installationSuspended: () => StubScenario
  readonly paged: () => StubScenario
  readonly unlimited: () => StubScenario
  readonly retiredModelProfile: () => StubScenario
  readonly noModelProfiles: () => StubScenario
  readonly modelProfilesUnavailable: () => StubScenario
  readonly overviewUnavailable: () => StubScenario
  readonly importAbsent: () => StubScenario
  readonly importPlanning: () => StubScenario
  readonly importDiscovering: () => StubScenario
  readonly importAwaitingApproval: () => StubScenario
  readonly importAwaitingAuthorization: () => StubScenario
  readonly importProcessing: () => StubScenario
  readonly importPaused: () => StubScenario
  readonly importCompleted: () => StubScenario
  readonly importFailed: () => StubScenario
  readonly importCancelled: () => StubScenario
  readonly importResumeBlocked: () => StubScenario
  readonly memory: () => StubScenario
  readonly memoryEmpty: () => StubScenario
  readonly memoryUnavailable: () => StubScenario
  readonly memoryPaged: () => StubScenario
  readonly memoryEvidenceUnavailable: () => StubScenario
}

export type StubScenarioName = keyof typeof SCENARIOS
