import type { GithubInstallation, Repository, RepositoryPage } from "@contracts/console"

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
}

export declare const SCENARIOS: Readonly<Record<string, () => StubScenario>>
