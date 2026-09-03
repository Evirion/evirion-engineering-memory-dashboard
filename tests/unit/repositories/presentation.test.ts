import { describe, expect, it } from "vitest"

import type { Repository, RepositoryPage } from "@contracts/console"

import {
  accessAxis,
  capacitySummary,
  entitlementAxis,
  offeredProfiles,
  overviewGroups,
  policyAxis,
  productStateLabel,
  repositoryControls,
  retiredNamedByConsent,
} from "@/lib/repositories/presentation"
import { POLICY_TERMS, policyTerm } from "@/lib/repositories/vocabulary"

/**
 * EEM-9/03 C03-3.
 *
 * The failure mode this guards against is one status chip. Access, entitlement
 * and policy are orthogonal, so every combination must remain separately
 * readable, and operator-managed and locked must not read as failures.
 */

const OWNER = [
  "organization.read",
  "repository.entitlements.manage",
  "repository.policy.manage",
] as const

const VIEWER = ["organization.read"] as const

const repository = (overrides: Partial<Repository> = {}): Repository => ({
  id: "00000000-0000-4000-8000-000000000001",
  nameWithOwner: "acme/console",
  archived: false,
  accessible: true,
  productState: "ACTIVE_SOURCE_ONLY",
  entitlement: { generation: 1, source: "DESIGN_PARTNER", state: "ACTIVE", version: 2 },
  policy: { mode: "SOURCE_ONLY", version: 1 },
  effectiveConsent: null,
  changeRequest: null,
  ...overrides,
})

const fixedLimit: RepositoryPage["summary"]["limit"] = {
  maxActiveRepositories: 4,
  mode: "FIXED",
  replacementMode: "SELF_SERVICE",
}

const operatorLimit: RepositoryPage["summary"]["limit"] = {
  maxActiveRepositories: 1,
  mode: "FIXED",
  replacementMode: "OPERATOR_ONLY",
}

describe("the three axes stay three", () => {
  it("answers each axis with its own label and its own text value", () => {
    const subject = repository()
    const axes = [accessAxis(subject), entitlementAxis(subject), policyAxis(subject)]

    expect(axes.map((axis) => axis.label)).toEqual([
      "GitHub access",
      "Evirion entitlement",
      "Live processing",
    ])
    // Text, not colour: NFR-ACC-001 requires a non-colour status indicator.
    for (const axis of axes) {
      expect(axis.value.length).toBeGreaterThan(0)
      expect(axis.detail.length).toBeGreaterThan(0)
    }
  })

  it("separates an accessible repository that is not entitled", () => {
    const subject = repository({
      entitlement: null,
      policy: null,
      productState: "AVAILABLE_LOCKED",
    })

    expect(accessAxis(subject).value).toBe("Accessible")
    expect(entitlementAxis(subject).value).toBe("Not activated")
    expect(policyAxis(subject).value).toBe("None")
  })

  it("separates an entitled repository whose live processing is off", () => {
    const subject = repository({
      policy: { mode: "OFF", version: 1 },
      productState: "ACTIVE_LIVE_OFF",
    })

    expect(entitlementAxis(subject).value).toBe("Active")
    expect(policyAxis(subject).value).toBe("Off")
  })

  it("separates a disabled entitlement from lost GitHub access", () => {
    const disabled = repository({
      entitlement: {
        generation: 2,
        source: "DESIGN_PARTNER",
        state: "DISABLED",
        version: 3,
      },
      productState: "ENTITLEMENT_DISABLED",
    })
    const unreachable = repository({
      accessible: false,
      access: {
        lastSeenSyncGeneration: 4,
        lastSuccessfulSyncAt: "2026-08-30T09:00:00Z",
        status: "INACCESSIBLE",
      },
      productState: "INACCESSIBLE",
    })

    expect(accessAxis(disabled).value).toBe("Accessible")
    expect(entitlementAxis(disabled).value).toBe("Disabled")
    expect(accessAxis(unreachable).value).toBe("Not accessible")
    expect(entitlementAxis(unreachable).value).toBe("Active")
  })

  it("falls back to the coarse flag when the access block is absent", () => {
    // `access` is optional in the contract, so its absence must not be read as
    // inaccessible.
    expect(accessAxis(repository()).value).toBe("Accessible")
  })

  it("treats an archived repository as its own access answer", () => {
    expect(accessAxis(repository({ archived: true })).value).toBe("Archived")
  })

  it("never presents a resting state as a failure", () => {
    const locked = repository({
      entitlement: null,
      policy: null,
      productState: "AVAILABLE_LOCKED",
    })

    expect(entitlementAxis(locked).tone).toBe("neutral")
    expect(policyAxis(locked).tone).toBe("neutral")
    expect(entitlementAxis(repository()).tone).toBe("neutral")
  })

  it("says that automatic extraction still waits on Evirion", () => {
    const auto = repository({
      policy: { mode: "AUTO_EXTRACT", version: 2 },
      productState: "ACTIVE_AUTO_EXTRACT",
    })

    expect(policyAxis(auto).detail).toMatch(/Evirion/)
    expect(policyAxis(auto).detail).toMatch(/still required|separate/i)
  })
})

describe("every published product state has a label", () => {
  it.each([
    "ARCHIVED",
    "INACCESSIBLE",
    "AVAILABLE_LOCKED",
    "ENTITLEMENT_DISABLED",
    "ACTIVE_LIVE_OFF",
    "ACTIVE_SOURCE_ONLY",
    "ACTIVE_AUTO_EXTRACT",
    "CHANGE_REQUESTED",
  ] as const)("labels %s", (state) => {
    expect(productStateLabel(state).length).toBeGreaterThan(0)
  })

  it("distinguishes available from active", () => {
    // REPO-001: `Available` must not look like `Active`.
    expect(productStateLabel("AVAILABLE_LOCKED")).not.toBe(
      productStateLabel("ACTIVE_LIVE_OFF"),
    )
    expect(productStateLabel("AVAILABLE_LOCKED")).toMatch(/not activated/i)
  })
})

describe("which controls are offered", () => {
  it("offers activation only for an accessible, unentitled repository", () => {
    const locked = repository({ entitlement: null, productState: "AVAILABLE_LOCKED" })

    expect(repositoryControls(locked, fixedLimit, OWNER).canActivate).toBe(true)
    expect(repositoryControls(repository(), fixedLimit, OWNER).canActivate).toBe(false)
  })

  it("never offers activation for an inaccessible or archived repository", () => {
    const gone = repository({
      entitlement: null,
      accessible: false,
      productState: "INACCESSIBLE",
    })
    const archived = repository({
      entitlement: null,
      archived: true,
      productState: "ARCHIVED",
    })

    expect(repositoryControls(gone, fixedLimit, OWNER).canActivate).toBe(false)
    expect(repositoryControls(archived, fixedLimit, OWNER).canActivate).toBe(false)
  })

  it("offers disable only where replacement is self-service", () => {
    expect(repositoryControls(repository(), fixedLimit, OWNER).canDisable).toBe(true)
    expect(repositoryControls(repository(), operatorLimit, OWNER).canDisable).toBe(
      false,
    )
  })

  it("offers a change request instead where an operator owns replacement", () => {
    const controls = repositoryControls(repository(), operatorLimit, OWNER)

    expect(controls.canRequestChange).toBe(true)
    expect(controls.operatorManaged).toBe(true)
  })

  it("does not offer a second change request while one is outstanding", () => {
    const requested = repository({
      changeRequest: {
        id: "00000000-0000-4000-8000-0000000000e1",
        requestedRepositoryId: "00000000-0000-4000-8000-000000000003",
        state: "REQUESTED",
        version: 1,
      },
      productState: "CHANGE_REQUESTED",
    })

    expect(repositoryControls(requested, operatorLimit, OWNER).canRequestChange).toBe(
      false,
    )
  })

  it("offers nothing a viewer's capabilities do not carry", () => {
    const controls = repositoryControls(repository(), fixedLimit, VIEWER)

    expect(controls).toMatchObject({
      canActivate: false,
      canDisable: false,
      canRequestChange: false,
      canChangePolicy: false,
    })
  })

  it("treats a missing allowance as operator-managed rather than as permission", () => {
    const controls = repositoryControls(repository(), null, OWNER)

    expect(controls.operatorManaged).toBe(true)
    expect(controls.canActivate).toBe(false)
    expect(controls.canDisable).toBe(false)
  })
})

describe("capacity as the backend reports it", () => {
  it("reports a fixed allowance as a fraction", () => {
    expect(
      capacitySummary({
        accessibleRepositories: 7,
        activeRepositories: 2,
        limit: fixedLimit,
      }).value,
    ).toBe("2 of 4 active")
  })

  it("reports an unlimited allowance without inventing a denominator", () => {
    const summary = capacitySummary({
      accessibleRepositories: 7,
      activeRepositories: 2,
      limit: {
        maxActiveRepositories: null,
        mode: "UNLIMITED",
        replacementMode: "SELF_SERVICE",
      },
    })

    expect(summary.value).toBe("2 active")
    expect(summary.value).not.toMatch(/of\s+0/)
  })

  it("says an unprovisioned allowance is unprovisioned, never zero", () => {
    const summary = capacitySummary({
      accessibleRepositories: 7,
      activeRepositories: 0,
      limit: null,
    })

    expect(summary.detail).toMatch(/no repository allowance is provisioned/i)
  })
})

describe("the four confusable terms", () => {
  it("keeps all four separate and distinctly worded", () => {
    const ids = POLICY_TERMS.map((term) => term.id)

    expect(ids).toEqual([
      "source-work",
      "customer-consent",
      "operational-authorization",
      "paid-execution",
    ])
    expect(new Set(POLICY_TERMS.map((term) => term.term)).size).toBe(4)
    expect(new Set(POLICY_TERMS.map((term) => term.meaning)).size).toBe(4)
  })

  it("assigns each term to whoever actually has to act", () => {
    expect(policyTerm("customer-consent").heldBy).toBe("you")
    expect(policyTerm("operational-authorization").heldBy).toBe("evirion")
    expect(policyTerm("paid-execution").heldBy).toBe("evirion")
  })

  it("states that consent does not grant Evirion authorization", () => {
    expect(policyTerm("operational-authorization").meaning).toMatch(
      /consent never grants this/i,
    )
  })

  it("states that source work calls no model", () => {
    expect(policyTerm("source-work").meaning).toMatch(/no model is called/i)
  })
})

/**
 * EEM-9/03e. The counters `REPO-003` describes and the contract publishes.
 *
 * `REPO-003` names sixteen; `repository-overview.json` publishes seventeen. The
 * extra is `withdrawn`, the discrepancy backend issue #53 recorded and resolved
 * deliberately, so the published schema is what these assertions follow.
 */
describe("repository overview counters", () => {
  const overview = {
    repositoryId: "00000000-0000-4000-8000-000000000302",
    nameWithOwner: "evirion/repository",
    asOf: "2026-09-02T18:33:41.123456Z",
    processing: {
      mergedPullRequestsDiscovered: 12,
      sourceEnvelopesPrepared: 12,
      awaitingApproval: 1,
      processing: 2,
      completedRuns: 8,
      rejectedRuns: 1,
      quarantinedRuns: 0,
      failedJobs: 0,
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
    },
  } as const

  const groups = () => overviewGroups(overview)

  it("renders every published counter and invents none", () => {
    const rendered = groups().flatMap((group) => group.counters)

    expect(rendered).toHaveLength(17)
    expect(rendered.map((counter) => counter.key)).toEqual([
      ...Object.keys(overview.processing),
      ...Object.keys(overview.engineeringMemory),
    ])
  })

  it("keeps machine dispositions out of the Engineering Memory group", () => {
    const [processing, memory] = groups()

    expect(processing?.counters.map((counter) => counter.key)).toContain("rejectedRuns")
    expect(processing?.counters.map((counter) => counter.key)).toContain(
      "quarantinedRuns",
    )
    expect(memory?.counters.map((counter) => counter.key)).not.toContain("rejectedRuns")
    expect(memory?.counters.map((counter) => counter.key)).not.toContain(
      "quarantinedRuns",
    )
  })

  it("never labels a machine rejection and a reviewer rejection the same way", () => {
    const labels = groups().flatMap((group) =>
      group.counters.map((counter) => counter.label),
    )

    expect(new Set(labels).size).toBe(labels.length)
  })

  it("carries a real zero through as a number rather than blanking it", () => {
    const zero = groups()
      .flatMap((group) => group.counters)
      .find((counter) => counter.key === "quarantinedRuns")

    expect(zero?.value).toBe(0)
  })

  it("states that rejected and quarantined runs are not Knowledge Objects", () => {
    expect(groups()[0]?.note).toMatch(/never become Knowledge Objects/i)
  })
})

/**
 * EEM-9/03e. The consent catalogue, and the state a customer cannot fix.
 *
 * Withdrawing an offer does not revoke a consent already given, so a recorded
 * consent can name a profile the organization may no longer pick. Dropping that
 * row would hide a live consent; showing it as an ordinary choice would invite
 * a re-selection the backend refuses. It gets its own state.
 */
/**
 * The registry stores identifier, provider and model separately. The identifier
 * is never recomposed from the other two, so the fixture keeps them distinct.
 */
const profile = (
  canonicalIdentifier: string,
  availability: "OFFERED" | "NO_LONGER_OFFERED",
  namedByActiveConsent: boolean,
  offeringState: "AVAILABLE" | "DEPRECATED" | "RETIRED" = "AVAILABLE",
) => {
  const [provider, ...model] = canonicalIdentifier.split("-")
  return {
    canonicalIdentifier,
    provider: provider as string,
    modelId: model.join("-"),
    offeringState,
    availability,
    namedByActiveConsent,
  }
}

describe("model profile catalogue", () => {
  const catalogue = {
    organizationId: "00000000-0000-4000-8000-000000000301",
    modelProfiles: [
      profile("anthropic-claude-sonnet-4", "OFFERED", true),
      profile("openai-gpt-5-mini", "NO_LONGER_OFFERED", true, "RETIRED"),
      profile("openai-gpt-5", "OFFERED", false),
      profile("anthropic-claude-haiku-4", "NO_LONGER_OFFERED", false, "DEPRECATED"),
    ],
  }

  it("offers only what the organization may still name", () => {
    expect(
      offeredProfiles(catalogue).map((entry) => entry.canonicalIdentifier),
    ).toEqual(["anthropic-claude-sonnet-4", "openai-gpt-5"])
  })

  it("surfaces a withdrawn profile this repository's consent still names", () => {
    // A withdrawn profile nobody consented to is not the customer's problem and
    // is simply not offered. One a live consent names is a state they cannot fix.
    expect(
      retiredNamedByConsent(catalogue, ["openai-gpt-5-mini"]).map(
        (entry) => entry.canonicalIdentifier,
      ),
    ).toEqual(["openai-gpt-5-mini"])
  })

  it("says nothing about a withdrawal this repository's consent does not name", () => {
    // `namedByActiveConsent` is true across the organization, so filtering on
    // it alone would report one repository's withdrawn profile on every other
    // repository's page, where it names nothing.
    expect(retiredNamedByConsent(catalogue, ["openai-gpt-5"])).toEqual([])
    expect(retiredNamedByConsent(catalogue, [])).toEqual([])
  })

  it("finds nothing to surface when every named profile is still offered", () => {
    expect(
      retiredNamedByConsent(
        {
          organizationId: catalogue.organizationId,
          modelProfiles: [profile("openai-gpt-5", "OFFERED", true)],
        },
        ["openai-gpt-5"],
      ),
    ).toEqual([])
  })

  it("labels a choice by provider and model rather than by identifier alone", () => {
    const [first] = offeredProfiles(catalogue)

    expect(first?.label).toBe("anthropic claude-sonnet-4")
    expect(first?.canonicalIdentifier).toBe("anthropic-claude-sonnet-4")
  })

  it("treats an empty catalogue as nothing to offer rather than as an error", () => {
    const empty = { organizationId: catalogue.organizationId, modelProfiles: [] }

    expect(offeredProfiles(empty)).toEqual([])
    expect(retiredNamedByConsent(empty, ["openai-gpt-5-mini"])).toEqual([])
  })
})
