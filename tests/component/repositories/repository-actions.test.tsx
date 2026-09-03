import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { Repository } from "@contracts/console"

import {
  ActivateForm,
  ConsentForm,
  DisableForm,
  OperatorManagedNotice,
  PolicyForm,
  RequestChangeForm,
} from "@/components/repositories/repository-actions"
import { repositoryControls } from "@/lib/repositories/presentation"
import type { ModelProfileCatalogueView } from "@/server/queries/repositories"

import {
  MODEL_PROFILES,
  MODEL_PROFILES_EMPTY,
  REPOSITORIES,
  SCENARIOS,
} from "../../../tools/console-stub/fixtures.mjs"

const offered = (): ModelProfileCatalogueView => ({
  status: "ready",
  catalogue: MODEL_PROFILES(),
})

/**
 * EEM-9/03 C03-5, the rendered half.
 *
 * A control that the backend capability does not permit must not render, and a
 * control that does render must carry the CSRF proof, one idempotency key and
 * the backend's own expected version. Hiding is a convenience: the refusal path
 * is proved separately against the running BFF.
 */

const scenario = SCENARIOS.default()
const operatorScenario = SCENARIOS.operatorOnly()

const find = (id: string): Repository =>
  scenario.repositories.find((repository) => repository.id === id) as Repository

const OWNER = [
  "organization.read",
  "repository.entitlements.manage",
  "repository.policy.manage",
]
const VIEWER = ["organization.read"]

const contextFor = (
  repository: Repository,
  capabilities: readonly string[],
  limit = scenario.limit,
) => ({
  repository,
  controls: repositoryControls(repository, limit, capabilities),
  csrfToken: "csrf-proof",
  idempotencyKeys: {
    activate: "00000000-0000-4000-8000-0000000000a1",
    disable: "00000000-0000-4000-8000-0000000000a2",
    "request-change": "00000000-0000-4000-8000-0000000000a3",
    policy: "00000000-0000-4000-8000-0000000000a4",
    consent: "00000000-0000-4000-8000-0000000000a5",
  },
})

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe("the activation control", () => {
  const context = contextFor(find(REPOSITORIES.availableLocked), OWNER)
  const rendered = markup(<ActivateForm {...context} />)

  it("states the consequences REPO-002 fixes, verbatim", () => {
    for (const consequence of [
      "process future merged pull requests;",
      "prepare historical pull requests;",
      "run approved model extraction;",
      "retain usage for this repository.",
    ]) {
      expect(rendered).toContain(consequence)
    }
  })

  it("requires an explicit confirmation rather than defaulting to one", () => {
    expect(rendered).toContain('name="confirmationAccepted"')
    expect(rendered).not.toContain("checked")
  })

  it("carries the proof, one key and an empty first-activation version", () => {
    expect(rendered).toContain('name="csrfToken" value="csrf-proof"')
    expect(rendered).toContain(
      'name="idempotencyKey" value="00000000-0000-4000-8000-0000000000a1"',
    )
    // No entitlement yet, so the contract's null expected version.
    expect(rendered).toContain('name="expectedVersion" value=""')
  })

  it("says Evirion authorization is still separate", () => {
    expect(rendered).toMatch(/consent never grants this/i)
  })

  it("does not render for a caller without the capability", () => {
    expect(
      markup(
        <ActivateForm {...contextFor(find(REPOSITORIES.availableLocked), VIEWER)} />,
      ),
    ).toBe("")
  })

  it("does not render for an already active repository", () => {
    expect(
      markup(
        <ActivateForm {...contextFor(find(REPOSITORIES.activeSourceOnly), OWNER)} />,
      ),
    ).toBe("")
  })
})

describe("the disable and change-request controls", () => {
  it("offers disable where replacement is self-service, with the backend version", () => {
    const rendered = markup(
      <DisableForm {...contextFor(find(REPOSITORIES.activeSourceOnly), OWNER)} />,
    )

    expect(rendered).toContain('action="/api/repositories/disable"')
    expect(rendered).toContain('name="expectedVersion" value="2"')
    expect(rendered).toMatch(/does not delete history or usage/)
  })

  it("offers a change request instead where an operator owns replacement", () => {
    const repository = find(REPOSITORIES.activeSourceOnly)
    const context = contextFor(repository, OWNER, operatorScenario.limit)

    expect(markup(<DisableForm {...context} />)).toBe("")

    const change = markup(
      <RequestChangeForm
        {...context}
        candidates={[find(REPOSITORIES.availableLocked)]}
        candidatesTruncated={false}
      />,
    )
    expect(change).toContain('action="/api/repositories/request-change"')
    expect(change).toContain("acme/payments")
    expect(change).toMatch(/does not free the slot/)
    expect(change).not.toMatch(/first hundred/)
  })

  it("says so when the candidate list is only the first page", () => {
    // Offering a partial list as though it were complete is the same defect
    // as rendering an unavailable count as zero.
    const change = markup(
      <RequestChangeForm
        {...contextFor(
          find(REPOSITORIES.activeSourceOnly),
          OWNER,
          operatorScenario.limit,
        )}
        candidates={[find(REPOSITORIES.availableLocked)]}
        candidatesTruncated
      />,
    )

    expect(change).toMatch(/first hundred accessible repositories/)
  })

  it("explains an operator-managed allowance rather than saying nothing", () => {
    const context = contextFor(
      find(REPOSITORIES.activeSourceOnly),
      OWNER,
      operatorScenario.limit,
    )

    expect(markup(<OperatorManagedNotice controls={context.controls} />)).toMatch(
      /operator action/i,
    )
  })
})

describe("the policy controls", () => {
  const context = contextFor(find(REPOSITORIES.activeSourceOnly), OWNER)

  it("offers only off and source-only without a consent", () => {
    const rendered = markup(<PolicyForm {...context} />)

    expect(rendered).toContain('value="OFF"')
    expect(rendered).toContain('value="SOURCE_ONLY"')
    // AUTO_EXTRACT is never reachable from the mode control alone.
    expect(rendered).not.toContain('value="AUTO_EXTRACT"')
  })

  it("offers no way to promote a single live envelope", () => {
    // Alpha has no "approve this one later" action; behaviour changes only
    // through a versioned policy update.
    expect(markup(<PolicyForm {...context} />)).not.toMatch(/approve|promote/i)
  })

  it("carries the policy version, not the entitlement version", () => {
    // Entitlement version is 2 and policy version is 3 for this fixture.
    expect(markup(<PolicyForm {...context} />)).toContain(
      'name="expectedVersion" value="3"',
    )
  })

  it("collects every consent field automatic extraction needs", () => {
    const rendered = markup(<ConsentForm {...context} modelProfiles={offered()} />)

    for (const name of [
      "allowedModelProfiles",
      "callCeiling",
      "budgetCeilingUsd",
      "retryPolicy",
      "expiresAt",
    ]) {
      expect(rendered).toContain(`name="${name}"`)
    }
    expect(rendered).toContain('name="mode" value="AUTO_EXTRACT"')
  })

  it("says that recording consent does not authorize a paid call", () => {
    expect(markup(<ConsentForm {...context} modelProfiles={offered()} />)).toMatch(
      /consent never grants this/i,
    )
  })

  it("offers the catalogue as a choice rather than as free text", () => {
    const rendered = markup(<ConsentForm {...context} modelProfiles={offered()} />)

    // Free text is what made a typo indistinguishable from an unavailable
    // model, which is the defect this surface exists to remove.
    expect(rendered).not.toContain('type="text" name="allowedModelProfiles"')
    expect(rendered).toContain(
      'type="checkbox" name="allowedModelProfiles" value="anthropic-claude-sonnet-4"',
    )
    expect(rendered).toContain("anthropic claude-sonnet-4")
  })

  it("posts the registry identifier, never a label composed from the parts", () => {
    const rendered = markup(<ConsentForm {...context} modelProfiles={offered()} />)

    expect(rendered).toContain('value="openai-gpt-5"')
    expect(rendered).not.toContain('value="openai gpt-5"')
  })

  it("offers nothing the organization may no longer name", () => {
    const rendered = markup(<ConsentForm {...context} modelProfiles={offered()} />)

    expect(rendered).not.toContain("anthropic-claude-haiku-3")
  })

  it("prefills an existing consent by checking what it already names", () => {
    const rendered = markup(
      <ConsentForm
        {...contextFor(find(REPOSITORIES.activeAutoExtract), OWNER)}
        modelProfiles={offered()}
      />,
    )

    expect(rendered).toMatch(
      /value="anthropic-claude-sonnet-4"[^>]*checked|checked[^>]*value="anthropic-claude-sonnet-4"/,
    )
  })

  it("withholds the form entirely when the catalogue cannot be read", () => {
    const rendered = markup(
      <ConsentForm
        {...context}
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

    // Falling back to free text here would put the worst version of the
    // feature behind the least visible condition.
    expect(rendered).not.toContain("<form")
    expect(rendered).not.toContain('name="allowedModelProfiles"')
    expect(rendered).toMatch(/cannot be read right now/i)
    expect(rendered).toMatch(/Nothing has changed/i)
  })

  it("states plainly when nothing is offered, rather than showing an empty form", () => {
    const rendered = markup(
      <ConsentForm
        {...context}
        modelProfiles={{ status: "ready", catalogue: MODEL_PROFILES_EMPTY() }}
      />,
    )

    expect(rendered).not.toContain("<form")
    expect(rendered).toMatch(/No model profiles are currently offered/i)
  })

  it("renders no policy control for a caller without the capability", () => {
    const viewer = contextFor(find(REPOSITORIES.activeSourceOnly), VIEWER)

    expect(markup(<PolicyForm {...viewer} />)).toBe("")
    expect(markup(<ConsentForm {...viewer} modelProfiles={offered()} />)).toBe("")
  })
})
