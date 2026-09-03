import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { Repository } from "@contracts/console"

import { RepositoryCounters } from "@/components/repositories/repository-counters"
import {
  ChangeRequestNotice,
  ConsentFacts,
  EntitlementFacts,
  PolicyVocabulary,
} from "@/components/repositories/repository-detail"

import type { ModelProfileCatalogueView } from "@/server/queries/repositories"

import {
  MODEL_PROFILES,
  MODEL_PROFILES_WITH_RETIRED,
  OVERVIEWS,
  REPOSITORIES,
  SCENARIOS,
} from "../../../tools/console-stub/fixtures.mjs"

/**
 * EEM-9/03 C03-4, extended by EEM-9/03e.
 *
 * The detail page states the facts behind the three axes without ever letting
 * the customer select one, and it keeps the four gates apart. Since
 * `console-contract-v1.0.1` published `repository-overview.json`, it also
 * carries the `REPO-003` counters, which is open decision 6 answered.
 */

const repositories = SCENARIOS.default().repositories
const find = (id: string): Repository =>
  repositories.find((repository) => repository.id === id) as Repository

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe("entitlement facts", () => {
  it("states that access alone activates nothing when there is no entitlement", () => {
    const rendered = markup(
      <EntitlementFacts repository={find(REPOSITORIES.availableLocked)} />,
    )

    expect(rendered).toMatch(/GitHub access alone never activates one/)
  })

  it("shows state, source and generation as read-only facts", () => {
    const rendered = markup(
      <EntitlementFacts repository={find(REPOSITORIES.activeAutoExtract)} />,
    )

    expect(rendered).toContain("Active")
    expect(rendered).toContain("an Evirion operator exception")
    expect(rendered).toContain("Generation")
    // Read-only: nothing here is a control the customer could set.
    expect(rendered).not.toContain("<select")
    expect(rendered).not.toContain("<input")
  })

  it("distinguishes a disabled entitlement from an absent one", () => {
    const disabled = markup(
      <EntitlementFacts repository={find(REPOSITORIES.entitlementDisabled)} />,
    )

    expect(disabled).toContain("Disabled")
    expect(disabled).not.toMatch(/has no Evirion entitlement/)
  })
})

const catalogue = (
  value: ReturnType<typeof MODEL_PROFILES>,
): ModelProfileCatalogueView => ({ status: "ready", catalogue: value })

describe("recorded consent", () => {
  it("says plainly when no consent exists", () => {
    const rendered = markup(
      <ConsentFacts
        repository={find(REPOSITORIES.activeSourceOnly)}
        modelProfiles={catalogue(MODEL_PROFILES())}
      />,
    )

    expect(rendered).toMatch(/No consent is recorded/)
  })

  it("shows the ceilings as ceilings, never as a spend or an invoice figure", () => {
    const rendered = markup(
      <ConsentFacts
        repository={find(REPOSITORIES.activeAutoExtract)}
        modelProfiles={catalogue(MODEL_PROFILES())}
      />,
    )

    expect(rendered).toContain("anthropic-claude-sonnet-4")
    expect(rendered).toContain("Call ceiling")
    expect(rendered).toContain("40.000000 USD ceiling")
    expect(rendered).not.toMatch(/spent|invoice|charged so far/i)
  })

  it("says nothing extra while every named profile is still offered", () => {
    const rendered = markup(
      <ConsentFacts
        repository={find(REPOSITORIES.activeAutoExtract)}
        modelProfiles={catalogue(MODEL_PROFILES())}
      />,
    )

    expect(rendered).not.toMatch(/no longer offers/i)
  })

  it("renders a withdrawn profile a live consent names as its own state", () => {
    const rendered = markup(
      <ConsentFacts
        repository={find(REPOSITORIES.activeAutoExtract)}
        modelProfiles={catalogue(MODEL_PROFILES_WITH_RETIRED())}
      />,
    )

    expect(rendered).toMatch(/no longer offers/i)
    expect(rendered).toContain("anthropic claude-sonnet-4")
    expect(rendered).toContain("retired")
    // A state, not a failure, and not something the customer can fix here.
    expect(rendered).toMatch(/nothing to fix here/i)
    expect(rendered).not.toContain("<button")
  })

  it("says nothing about profiles when the catalogue cannot be read", () => {
    // Silence is right here: an unreadable catalogue is not evidence that a
    // profile was withdrawn, and claiming one was would be inventing a state.
    const rendered = markup(
      <ConsentFacts
        repository={find(REPOSITORIES.activeAutoExtract)}
        modelProfiles={{
          status: "unavailable",
          failure: {
            code: "DEPENDENCY_UNAVAILABLE",
            treatment: "retry-bounded",
            message: "The service is busy. Try again shortly.",
            retryable: true,
          },
        }}
      />,
    )

    expect(rendered).not.toMatch(/no longer offers/i)
    expect(rendered).toContain("anthropic-claude-sonnet-4")
  })
})

describe("an outstanding change request", () => {
  it("renders as a waiting state with no customer action", () => {
    const rendered = markup(
      <ChangeRequestNotice repository={find(REPOSITORIES.changeRequested)} />,
    )

    expect(rendered).toMatch(/with an Evirion operator/)
    expect(rendered).toMatch(/nothing further to do/)
    expect(rendered).not.toContain("<button")
  })

  it("renders nothing when no change is outstanding", () => {
    expect(
      markup(<ChangeRequestNotice repository={find(REPOSITORIES.activeSourceOnly)} />),
    ).toBe("")
  })
})

describe("the four gates on screen", () => {
  const rendered = markup(<PolicyVocabulary />)

  it("names all four separately", () => {
    for (const term of [
      "Source work",
      "Your consent",
      "Evirion authorization",
      "Paid execution",
    ]) {
      expect(rendered).toContain(term)
    }
  })

  it("says which of them the customer decides and which Evirion decides", () => {
    expect(rendered.split("you decide this").length - 1).toBe(2)
    expect(rendered.split("Evirion decides this").length - 1).toBe(2)
  })

  it("states that consent does not grant Evirion authorization", () => {
    expect(rendered).toMatch(/consent never grants this/i)
  })

  it("states that source work calls no model", () => {
    expect(rendered).toMatch(/No model is called/i)
  })
})

describe("repository counters", () => {
  const overview = OVERVIEWS()[REPOSITORIES.activeSourceOnly]
  if (overview === undefined) throw new Error("the fixture has no overview to render")
  const ready = { status: "ready", overview } as const

  it("renders all seventeen published counters", () => {
    const rendered = markup(<RepositoryCounters view={ready} />)

    for (const label of [
      "Merged pull requests discovered",
      "Source envelopes prepared",
      "Awaiting approval",
      "Processing now",
      "Completed runs",
      "Runs the model rejected",
      "Runs quarantined as invalid",
      "Failed jobs",
      "Knowledge Objects admitted",
      "Awaiting review",
      "Approved by a reviewer",
      "Edited by a reviewer",
      "Rejected by a reviewer",
      "Unresolved",
      "Active",
      "Superseded",
      "Withdrawn",
    ]) {
      expect(rendered, label).toContain(label)
    }
  })

  it("shows the cutoff it rendered, because two cutoffs are not comparable", () => {
    expect(markup(<RepositoryCounters view={ready} />)).toContain(
      "2026-09-02T18:33:41.123456Z",
    )
  })

  it("keeps rejected and quarantined runs out of the Knowledge Object count", () => {
    const rendered = markup(<RepositoryCounters view={ready} />)

    expect(rendered).toMatch(/never become Knowledge Objects/)
    expect(rendered).toMatch(/Only admitted Knowledge Objects are counted here/)
  })

  it("renders an unavailable overview as an explicit state and never as zero", () => {
    const rendered = markup(
      <RepositoryCounters
        view={{
          status: "unavailable",
          failure: {
            code: "DEPENDENCY_UNAVAILABLE",
            treatment: "retry-bounded",
            message: "The service is busy. Try again shortly.",
            retryable: true,
          },
        }}
      />,
    )

    expect(rendered).toMatch(/unavailable count is not a count of zero/)
    expect(rendered).toContain("DEPENDENCY_UNAVAILABLE")
    // The decisive assertion: no digit may appear where a counter would be.
    expect(rendered).not.toMatch(/<dd[^>]*>\s*\d/)
    expect(rendered).not.toContain("Knowledge Objects admitted")
  })

  it("renders a genuine zero as zero rather than hiding it", () => {
    // `quarantinedRuns` is 0 in the fixture. A dash or a blank would be
    // ambiguous with the unavailable state above, which is the whole point.
    expect(markup(<RepositoryCounters view={ready} />)).toMatch(
      /Runs quarantined as invalid<\/dt><dd[^>]*>0</,
    )
  })
})
