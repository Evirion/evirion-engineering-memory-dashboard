import type {
  GithubInstallation,
  Repository,
  RepositoryImport,
  RepositoryImportFailures,
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
}

export type StubScenarioName = keyof typeof SCENARIOS
