import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { Repository } from "@contracts/console"

import {
  ChangeRequestNotice,
  ConsentFacts,
  EntitlementFacts,
  PolicyVocabulary,
} from "@/components/repositories/repository-detail"

import { REPOSITORIES, SCENARIOS } from "../../../tools/console-stub/fixtures.mjs"

/**
 * EEM-9/03 C03-4.
 *
 * The detail page states the facts behind the three axes without ever letting
 * the customer select one, and it keeps the four gates apart. Repository
 * counters are deliberately absent: the contract publishes no schema for them,
 * so open decision 6 cannot be answered by either owning subtask yet.
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

describe("recorded consent", () => {
  it("says plainly when no consent exists", () => {
    const rendered = markup(
      <ConsentFacts repository={find(REPOSITORIES.activeSourceOnly)} />,
    )

    expect(rendered).toMatch(/No consent is recorded/)
  })

  it("shows the ceilings as ceilings, never as a spend or an invoice figure", () => {
    const rendered = markup(
      <ConsentFacts repository={find(REPOSITORIES.activeAutoExtract)} />,
    )

    expect(rendered).toContain("standard-extraction")
    expect(rendered).toContain("Call ceiling")
    expect(rendered).toContain("40.000000 USD ceiling")
    expect(rendered).not.toMatch(/spent|invoice|charged so far/i)
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
