import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { Repository, RepositoryPage } from "@contracts/console"

import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  RepositoryCapacity,
  RepositoryList,
  RepositoryPagination,
} from "@/components/repositories/repository-list"

import { SCENARIOS } from "../../../tools/console-stub/fixtures.mjs"

/**
 * EEM-9/03 C03-3, the rendered half.
 *
 * These assert what the contract requires of the markup rather than which
 * element carries it, because the list primitive is open decision 4. Rendering
 * to static markup keeps the supply-chain surface unchanged: no component
 * testing library is added for assertions this shape can make directly.
 */

const scenario = SCENARIOS.default()

const pageOf = (
  items: Repository[],
  nextCursor: string | null = null,
): RepositoryPage => ({
  items,
  page: { nextCursor },
  summary: {
    accessibleRepositories: items.filter((item) => item.accessible).length,
    activeRepositories: items.filter((item) => item.entitlement?.state === "ACTIVE")
      .length,
    limit: scenario.limit,
  },
})

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe("the repository list", () => {
  const rendered = markup(<RepositoryList page={pageOf(scenario.repositories)} />)

  it("renders one row per repository with a link to its detail", () => {
    for (const repository of scenario.repositories) {
      expect(rendered).toContain(repository.nameWithOwner)
      expect(rendered).toContain(`href="/repositories/${repository.id}"`)
    }
  })

  it("labels all three axes on every row", () => {
    // Counted as the label element, not as a substring: one axis explains
    // itself by naming another, and a substring count would absorb that.
    const labelled = (label: string): number =>
      rendered.split(`${label}</dt>`).length - 1

    for (const label of ["GitHub access", "Evirion entitlement", "Live processing"]) {
      expect(labelled(label)).toBe(scenario.repositories.length)
    }
  })

  it("never collapses the axes into a single status", () => {
    // The locked repository is accessible, unentitled and has no policy. All
    // three answers must appear, or the row has become one chip.
    const locked = scenario.repositories.find(
      (repository) => repository.productState === "AVAILABLE_LOCKED",
    )
    const row = markup(<RepositoryList page={pageOf([locked as Repository])} />)

    expect(row).toContain("Accessible")
    expect(row).toContain("Not activated")
    expect(row).toContain("None")
  })

  it("states each axis as text, so the state does not depend on colour", () => {
    const inaccessible = scenario.repositories.find(
      (repository) => repository.productState === "INACCESSIBLE",
    )
    const row = markup(<RepositoryList page={pageOf([inaccessible as Repository])} />)

    expect(row).toContain("Not accessible")
  })

  it("renders the empty inventory as an empty state, not as a failure", () => {
    const empty = markup(<RepositoryList page={pageOf([])} />)

    expect(empty).toMatch(/No repository is accessible yet/)
    expect(empty).not.toMatch(/error|failed|unavailable/i)
  })
})

describe("the capacity summary", () => {
  it("reports accessible and active as two separate counts", () => {
    const rendered = markup(
      <RepositoryCapacity summary={pageOf(scenario.repositories).summary} />,
    )

    expect(rendered).toContain("Accessible on GitHub")
    expect(rendered).toContain("Active in Evirion")
  })

  it("never renders an unprovisioned allowance as zero", () => {
    const rendered = markup(
      <RepositoryCapacity
        summary={{ accessibleRepositories: 3, activeRepositories: 0, limit: null }}
      />,
    )

    expect(rendered).toMatch(/no repository allowance is provisioned/i)
    expect(rendered).not.toMatch(/0 of 0/)
  })

  it("says replacement is an operator action where it is", () => {
    const rendered = markup(
      <RepositoryCapacity
        summary={{
          accessibleRepositories: 3,
          activeRepositories: 1,
          limit: {
            maxActiveRepositories: 1,
            mode: "FIXED",
            replacementMode: "OPERATOR_ONLY",
          },
        }}
      />,
    )

    expect(rendered).toMatch(/Evirion operator action/i)
  })
})

describe("the cursor control", () => {
  it("offers the next page only when the backend supplied a cursor", () => {
    const cursor = "00000000-0000-4000-8000-000000000002"

    expect(markup(<RepositoryPagination page={pageOf([], cursor)} />)).toContain(
      `href="/repositories?after=${cursor}"`,
    )
    expect(markup(<RepositoryPagination page={pageOf([], null)} />)).toBe("")
  })
})

describe("a page that cannot show data", () => {
  it("shows the reason, the backend's retryability and the support reference", () => {
    const rendered = markup(
      <ConsoleUnavailable
        heading="Repositories are not available right now"
        failure={{
          code: "ORGANIZATION_LIMIT_NOT_PROVISIONED",
          treatment: "state-final",
          message: "This action is not available in the current state.",
          retryable: false,
          requestId: "00000000-0000-4000-8000-0000000000ff",
        }}
      />,
    )

    expect(rendered).toContain("ORGANIZATION_LIMIT_NOT_PROVISIONED")
    expect(rendered).toContain("No, not by retrying")
    expect(rendered).toContain("00000000-0000-4000-8000-0000000000ff")
  })

  it("reports a retryable dependency failure as retryable", () => {
    const rendered = markup(
      <ConsoleUnavailable
        heading="Repositories are not available right now"
        failure={{
          code: "DEPENDENCY_UNAVAILABLE",
          treatment: "retry-bounded",
          message: "The service is busy. Try again shortly.",
          retryable: true,
        }}
      />,
    )

    expect(rendered).toContain("Yes, shortly")
  })
})
