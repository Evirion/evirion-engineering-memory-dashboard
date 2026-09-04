import { describe, expect, it } from "vitest"

import type { RepositoryImport } from "@contracts/console"
import {
  isConsoleError,
  isGithubInstallation,
  isKnowledgeCorrections,
  isKnowledgeEvidence,
  isKnowledgeReview,
  isRepository,
  isRepositoryImport,
  isRepositoryImportFailures,
  isRepositoryOverview,
  isRepositoryPage,
} from "@contracts/console"

import {
  CAPABILITIES,
  IMPORT_FAILURES,
  IMPORT_RUNS,
  KNOWLEDGE,
  KNOWLEDGE_OBJECTS,
  OVERVIEWS,
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

const PUBLISHED_REVIEW_STATUSES = [
  "PENDING",
  "APPROVED",
  "EDITED",
  "USER_REJECTED",
] as const

const PUBLISHED_LIFECYCLE_STATES = [
  "UNRESOLVED",
  "ACTIVE",
  "SUPERSEDED",
  "WITHDRAWN",
] as const

const PUBLISHED_REVIEW_ACTIONS = [
  "APPROVE",
  "EDIT",
  "USER_REJECT",
  "REVERT_TO_ORIGINAL_AND_APPROVE",
] as const

const PUBLISHED_REJECT_REASONS = [
  "INCORRECT",
  "NOT_DURABLE",
  "UNSUPPORTED",
  "TOO_VAGUE",
  "DUPLICATE",
  "OUTDATED",
  "OTHER",
] as const

const PUBLISHED_SEVERITIES = ["NONE", "MINOR", "MAJOR", "CRITICAL"] as const

const PUBLISHED_ADMISSION_DISPOSITIONS = [
  "ACCEPTED",
  "REJECTED",
  "QUARANTINED",
] as const

const PUBLISHED_ADMISSION_ORIGINS = [
  "MODEL",
  "DETERMINISTIC_POLICY",
  "VALIDATION",
] as const

const PUBLISHED_CORRECTION_STATUSES = [
  "REQUESTED",
  "EXECUTING",
  "EXECUTED",
  "FAILED",
  "REJECTED",
] as const

const PUBLISHED_CORRECTION_TYPES = [
  "RETRACT_SUPERSESSION",
  "WITHDRAW_ACTIVE_KNOWLEDGE",
  "RESTORE_UNRESOLVED",
] as const

const PUBLISHED_CORRECTION_REASONS = [
  "SUPERSESSION_ERRONEOUS",
  "KNOWLEDGE_NO_LONGER_TRUE",
  "KNOWLEDGE_MISATTRIBUTED",
  "OTHER",
] as const

const PUBLISHED_RELATION_STATES = ["ACTIVE", "RETRACTED"] as const

const PUBLISHED_ACTOR_KINDS = ["customer", "platform_operator"] as const

const PUBLISHED_COMPENSATING_STATES = ["UNRESOLVED", "ACTIVE", "WITHDRAWN"] as const

const knowledge = Object.values(KNOWLEDGE_OBJECTS())
const everyReview = knowledge.flatMap((object) => object.reviews)
const everyCorrection = knowledge.flatMap((object) => object.corrections)
const everyRelation = knowledge.flatMap((object) => [
  ...object.supersededBy,
  ...object.supersedes,
])

/** The effective decision is the last row, and no row means `PENDING`. */
const decisionOf = (object: (typeof knowledge)[number]): string =>
  object.reviews.at(-1)?.decision ?? "PENDING"

const sortedSet = (values: Iterable<string>): string[] =>
  [...new Set(values)].toSorted()

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

  it("validates every repository overview with the runtime schema", () => {
    for (const [repositoryId, overview] of Object.entries(OVERVIEWS())) {
      expect(isRepositoryOverview(overview), repositoryId).toBe(true)
      expect(overview.repositoryId).toBe(repositoryId)
    }
  })

  it("gives every repository in the inventory an overview", () => {
    // A detail page with no fixture would render the unavailable block, so a
    // journey asserting counters would pass for the wrong reason.
    const overviews = OVERVIEWS()

    for (const repository of SCENARIOS.default().repositories) {
      expect(overviews[repository.id], repository.nameWithOwner).toBeDefined()
    }
  })

  it("carries a genuine zero counter, which must not read as unavailable", () => {
    const overview = Object.values(OVERVIEWS())[0]

    expect(overview?.processing.quarantinedRuns).toBe(0)
  })

  it("validates every knowledge review and correction with the runtime schema", () => {
    for (const object of knowledge) {
      const id = object.base.knowledgeObjectId
      expect(
        isKnowledgeEvidence({ evidence: object.evidence, knowledgeObjectId: id }),
        id,
      ).toBe(true)
      expect(
        isKnowledgeCorrections({
          correctionRequests: object.corrections,
          knowledgeObjectId: id,
        }),
        id,
      ).toBe(true)
      for (const review of object.reviews) {
        expect(
          isKnowledgeReview(review),
          `${id} sequence ${review.reviewSequence}`,
        ).toBe(true)
      }
    }
  })

  it("keeps every review sequence monotonic from one", () => {
    // Sequence is the authority the effective projection selects by, so a
    // fixture whose rows disagreed with their order would let the surface
    // render an effective decision the backend would never choose.
    for (const object of knowledge) {
      expect(
        object.reviews.map((review) => review.reviewSequence),
        object.base.knowledgeObjectId,
      ).toEqual(object.reviews.map((_review, index) => index + 1))
    }
  })

  it("covers every published review decision", () => {
    expect(sortedSet(knowledge.map(decisionOf))).toEqual(
      [...PUBLISHED_REVIEW_STATUSES].toSorted(),
    )
  })

  it("covers every published lifecycle state", () => {
    expect(sortedSet(knowledge.map((object) => object.lifecycleState))).toEqual(
      [...PUBLISHED_LIFECYCLE_STATES].toSorted(),
    )
  })

  it("covers every published review action", () => {
    expect(sortedSet(everyReview.map((review) => review.action))).toEqual(
      [...PUBLISHED_REVIEW_ACTIONS].toSorted(),
    )
  })

  it("covers every published reject reason and issue severity", () => {
    expect(
      sortedSet(
        everyReview.flatMap((review) =>
          review.rejectReasonCode === undefined ? [] : [review.rejectReasonCode],
        ),
      ),
    ).toEqual([...PUBLISHED_REJECT_REASONS].toSorted())
    expect(
      sortedSet(
        everyReview.flatMap((review) =>
          review.issueSeverity === undefined ? [] : [review.issueSeverity],
        ),
      ),
    ).toEqual([...PUBLISHED_SEVERITIES].toSorted())
  })

  it("covers both admission outcomes that are never Knowledge Objects", () => {
    // `REJECTED` and `QUARANTINED` are legitimate machine decisions that
    // produced no knowledge. Without a fixture for each, no test could prove
    // the surface refuses to render one as trusted.
    const details = knowledge.map((object) => object.base.technicalDetails)

    expect(sortedSet(details.map((entry) => entry.admissionDisposition))).toEqual(
      [...PUBLISHED_ADMISSION_DISPOSITIONS].toSorted(),
    )
    expect(sortedSet(details.map((entry) => entry.admissionDecisionOrigin))).toEqual(
      [...PUBLISHED_ADMISSION_ORIGINS].toSorted(),
    )
  })

  it("covers every published cost completeness on a Knowledge Object", () => {
    // A knowledge cost is rendered by a different surface than an import one,
    // so the four states need their own fixtures here as well.
    expect(
      sortedSet(
        knowledge.flatMap((object) =>
          object.base.technicalDetails.cost === undefined
            ? []
            : [object.base.technicalDetails.cost.completeness],
        ),
      ),
    ).toEqual([...PUBLISHED_COST_STATES].toSorted())
  })

  it("covers every published correction status, type and reason", () => {
    expect(sortedSet(everyCorrection.map((entry) => entry.status))).toEqual(
      [...PUBLISHED_CORRECTION_STATUSES].toSorted(),
    )
    expect(sortedSet(everyCorrection.map((entry) => entry.requestType))).toEqual(
      [...PUBLISHED_CORRECTION_TYPES].toSorted(),
    )
    expect(sortedSet(everyCorrection.map((entry) => entry.reasonCode))).toEqual(
      [...PUBLISHED_CORRECTION_REASONS].toSorted(),
    )
  })

  it("covers both actor kinds and every compensating lifecycle state", () => {
    // The customer creates the request and an operator moves it. A fixture
    // with only one actor kind could not show that the timeline distinguishes
    // them, which is what keeps an operator action from reading as a customer
    // one.
    expect(
      sortedSet(
        everyCorrection.flatMap((entry) => entry.history.map((h) => h.actorKind)),
      ),
    ).toEqual([...PUBLISHED_ACTOR_KINDS].toSorted())
    expect(
      sortedSet(
        everyCorrection.flatMap((entry) =>
          entry.compensatingLifecycleState === undefined
            ? []
            : [entry.compensatingLifecycleState],
        ),
      ),
    ).toEqual([...PUBLISHED_COMPENSATING_STATES].toSorted())
  })

  it("covers both relation states, so a retracted edge is renderable", () => {
    expect(sortedSet(everyRelation.map((edge) => edge.relationState))).toEqual(
      [...PUBLISHED_RELATION_STATES].toSorted(),
    )
  })

  it("keeps every supersession edge paired in both directions", () => {
    // The relation is one row the backend projects onto both objects. An edge
    // present on one side only would let the direction render inconsistently.
    const objects = KNOWLEDGE_OBJECTS()

    for (const object of Object.values(objects)) {
      for (const edge of object.supersededBy) {
        expect(
          objects[edge.knowledgeObjectId]?.supersedes.map(
            (entry) => entry.knowledgeRelationId,
          ),
          edge.knowledgeRelationId,
        ).toContain(edge.knowledgeRelationId)
      }
    }
  })

  it("gives the machine-rejected and quarantined objects no review at all", () => {
    // Neither is a Knowledge Object, so neither can carry a human decision.
    const objects = KNOWLEDGE_OBJECTS()

    expect(objects[KNOWLEDGE.machineRejected]?.reviews).toEqual([])
    expect(objects[KNOWLEDGE.machineQuarantined]?.reviews).toEqual([])
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

  it("refuses review and lifecycle conflicts that name currentVersion", () => {
    // EEM-8/11 made sequence detail live on these conflicts. A double that still
    // emits currentVersion would let tests pass against bytes the backend cannot
    // send.
    for (const code of [
      "REVIEW_VERSION_CONFLICT",
      "LIFECYCLE_VERSION_CONFLICT",
    ] as const) {
      expect(
        isConsoleError({
          contractVersion: "1.0",
          requestId: "00000000-0000-4000-8000-000000000001",
          error: {
            code,
            message: "The token changed.",
            retryable: false,
            currentVersion: 0,
          },
        }),
      ).toBe(false)
      expect(
        isConsoleError({
          contractVersion: "1.0",
          requestId: "00000000-0000-4000-8000-000000000001",
          error: {
            code,
            message: "The token changed.",
            retryable: false,
            currentSequence: 0,
          },
        }),
      ).toBe(true)
    }
  })
})
