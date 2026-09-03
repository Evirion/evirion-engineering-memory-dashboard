import { describe, expect, it } from "vitest"

import type { RepositoryImport } from "@contracts/console"
import {
  isGithubInstallation,
  isRepository,
  isRepositoryImport,
  isRepositoryImportFailures,
  isRepositoryPage,
} from "@contracts/console"

import {
  CAPABILITIES,
  IMPORT_FAILURES,
  IMPORT_RUNS,
  SCENARIOS,
  type StubScenario,
} from "../../tools/console-stub/fixtures.mjs"

/**
 * The browser gate is only worth what its double is worth.
 *
 * A lenient fixture would let a journey pass against bytes the real backend
 * could never send, so every fixture is validated with the same generated
 * schema the Console uses at runtime. The product-state coverage assertion is
 * what keeps the access x entitlement x policy matrix honest: adding a state to
 * the contract fails here until a fixture exercises it.
 */

const PUBLISHED_IMPORT_STATUSES = [
  "PLANNING",
  "DISCOVERING",
  "AWAITING_APPROVAL",
  "PROCESSING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const

const PUBLISHED_AUTHORIZATION_STATES = [
  "NOT_REQUIRED",
  "AWAITING_CUSTOMER_CONSENT",
  "AWAITING_OPERATIONAL_AUTHORIZATION",
  "AUTHORIZED",
  "EXPIRED",
  "REVOKED",
] as const

const PUBLISHED_COST_STATES = [
  "RESERVED",
  "MEASURED",
  "UNRESOLVED",
  "NOT_APPLICABLE",
] as const

const PUBLISHED_PRODUCT_STATES = [
  "ARCHIVED",
  "INACCESSIBLE",
  "AVAILABLE_LOCKED",
  "ENTITLEMENT_DISABLED",
  "ACTIVE_LIVE_OFF",
  "ACTIVE_SOURCE_ONLY",
  "ACTIVE_AUTO_EXTRACT",
  "CHANGE_REQUESTED",
] as const

const active = (scenario: StubScenario): number =>
  scenario.repositories.filter(
    (repository) => repository.entitlement?.state === "ACTIVE",
  ).length

const scenarios = Object.entries(SCENARIOS)
const everyScenario = scenarios.map(([name, build]) => [name, build()] as const)

describe("the Console API double serves contract-shaped bytes", () => {
  it.each(everyScenario)(
    "validates every repository in scenario %s",
    (name, scenario) => {
      for (const repository of scenario.repositories) {
        expect(
          isRepository(repository),
          `${name}: ${repository.nameWithOwner} is not a contract repository`,
        ).toBe(true)
      }
    },
  )

  it.each(everyScenario)(
    "validates the installation projection in scenario %s",
    (_name, scenario) => {
      expect(isGithubInstallation(scenario.installation)).toBe(true)
    },
  )

  it.each(everyScenario)(
    "validates an assembled first page in scenario %s",
    (_name, scenario) => {
      expect(
        isRepositoryPage({
          items: scenario.repositories.slice(0, scenario.pageSize),
          page: { nextCursor: null },
          summary: {
            accessibleRepositories: scenario.repositories.filter(
              (repository) => repository.accessible,
            ).length,
            activeRepositories: scenario.repositories.filter(
              (repository) => repository.entitlement?.state === "ACTIVE",
            ).length,
            limit: scenario.limit,
          },
        }),
      ).toBe(true)
    },
  )

  it("covers every published product state", () => {
    const covered = new Set(
      everyScenario.flatMap(([, scenario]) =>
        scenario.repositories.map((repository) => repository.productState),
      ),
    )

    expect([...covered].toSorted()).toEqual([...PUBLISHED_PRODUCT_STATES].toSorted())
  })

  it("exercises both a fixed and an unlimited organization limit", () => {
    const modes = new Set(
      everyScenario
        .map(([, scenario]) => scenario.limit?.mode)
        .filter((mode) => mode !== undefined),
    )

    expect(modes).toEqual(new Set(["FIXED", "UNLIMITED"]))
  })

  it("exercises both replacement modes, because they permit different controls", () => {
    const modes = new Set(
      everyScenario
        .map(([, scenario]) => scenario.limit?.replacementMode)
        .filter((mode) => mode !== undefined),
    )

    expect(modes).toEqual(new Set(["SELF_SERVICE", "OPERATOR_ONLY"]))
  })

  it("leaves a free slot in the default scenario and none in the full one", () => {
    expect(active(SCENARIOS.default())).toBeLessThan(5)
    expect(active(SCENARIOS.limitReached())).toBe(4)
  })

  it("validates every import fixture with the runtime schema", () => {
    for (const [name, build] of Object.entries(IMPORT_RUNS)) {
      expect(isRepositoryImport(build()), `${name} is not a contract import`).toBe(true)
    }
  })

  it("validates every failure list with the runtime schema", () => {
    for (const [importId, failures] of Object.entries(IMPORT_FAILURES())) {
      expect(isRepositoryImportFailures({ importId, failures }), importId).toBe(true)
    }
  })

  it("covers every published import status", () => {
    const covered = new Set(Object.values(IMPORT_RUNS).map((build) => build().status))

    expect([...covered].toSorted()).toEqual([...PUBLISHED_IMPORT_STATUSES].toSorted())
  })

  it("covers every published paid-authorization state", () => {
    const covered = new Set(
      Object.values(IMPORT_RUNS).map((build) => build().paidAuthorizationStatus),
    )

    expect([...covered].toSorted()).toEqual(
      [...PUBLISHED_AUTHORIZATION_STATES].toSorted(),
    )
  })

  it("covers every published cost completeness", () => {
    const covered = new Set(
      Object.values(IMPORT_RUNS).map((build) => build().cost.completeness),
    )

    expect([...covered].toSorted()).toEqual([...PUBLISHED_COST_STATES].toSorted())
  })

  it("exercises both a declared-retryable and a blocked failure", () => {
    const failures = Object.values(IMPORT_FAILURES()).flat()

    // Retryability is the backend's to declare, so the double has to be able
    // to say no as well as yes or the surface is never tested against a no.
    expect(new Set(failures.map((failure) => failure.retryable))).toEqual(
      new Set([true, false]),
    )
    expect(
      failures.some(
        (failure) => failure.retryBlocker === "REPOSITORY_IMPORT_JOB_NOT_RETRYABLE",
      ),
    ).toBe(true)
  })

  it("keeps a run whose failure count matches its failure list", () => {
    // A count that disagreed with the list would let the surface pass while
    // rendering an aggregate no list supports.
    const failed: RepositoryImport = IMPORT_RUNS.failed()

    expect(IMPORT_FAILURES()[failed.importId]).toHaveLength(failed.counts.failed)
  })

  it("names only capabilities the backend actually grants", () => {
    // `github.manage` and `usage.read` do not exist. A fixture inventing one
    // would make a control appear in a test that the backend would refuse.
    const granted = new Set([...CAPABILITIES.owner, ...CAPABILITIES.viewer])

    expect(granted.has("organization.github.manage")).toBe(true)
    expect(granted.has("repository.entitlements.manage")).toBe(true)
    expect(granted.has("repository.policy.manage")).toBe(true)
    expect(granted.has("github.manage")).toBe(false)
    expect(granted.has("usage.read")).toBe(false)
    expect(CAPABILITIES.viewer).not.toContain("repository.entitlements.manage")
    expect(CAPABILITIES.viewer).not.toContain("repository.policy.manage")
  })
})
