import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ApproveForm } from "@/components/imports/import-actions"
import { ImportCost } from "@/components/imports/import-progress"
import { IMPORT_CAPABILITY, importControls } from "@/lib/imports/presentation"
import { ConsentForm } from "@/components/repositories/repository-actions"
import { ConsentFacts } from "@/components/repositories/repository-detail"
import { repositoryControls } from "@/lib/repositories/presentation"

import type { ModelProfileCatalogueView } from "@/server/queries/repositories"

import {
  IMPORT_RUNS,
  MODEL_PROFILES,
  REPOSITORIES,
  SCENARIOS,
} from "../../../tools/console-stub/fixtures.mjs"

/**
 * MEM-UX/07 — import cost panel suspended; budget authorization inputs remain.
 */

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

const repositories = SCENARIOS.default().repositories
const repository = repositories.find(
  (entry) => entry.id === REPOSITORIES.activeAutoExtract,
)!

const catalogue = (): ModelProfileCatalogueView => ({
  status: "ready",
  catalogue: MODEL_PROFILES(),
})

describe("import cost panel", () => {
  it("renders nothing while cost reporting is suspended", () => {
    expect(markup(<ImportCost current={IMPORT_RUNS.completed()} />)).toBe("")
  })
})

const OWNER = [
  "organization.read",
  "repository.entitlements.manage",
  "repository.policy.manage",
]

describe("paid authorization fields stay visible", () => {
  it("keeps the import approval budget input and repository consent ceiling", () => {
    const approval = markup(
      <ApproveForm
        repository={repository}
        current={IMPORT_RUNS.awaitingApproval()}
        controls={importControls(repository, IMPORT_RUNS.awaitingApproval(), [
          IMPORT_CAPABILITY,
        ])}
        csrfToken="csrf"
        idempotencyKeys={{ approve: "00000000-0000-4000-8000-00000000b002" }}
        importReturnPath={`/repositories/${repository.id}/import`}
      />,
    )
    expect(approval).toContain('name="costBudgetUsd"')
    expect(approval).toContain("Cost budget in USD")

    const consent = markup(
      <ConsentForm
        repository={repository}
        controls={repositoryControls(repository, SCENARIOS.default().limit, OWNER)}
        csrfToken="csrf"
        idempotencyKeys={{ consent: "00000000-0000-4000-8000-0000000000a5" }}
        repositoryReturnPath={`/repositories/${repository.id}`}
        modelProfiles={catalogue()}
      />,
    )
    expect(consent).toContain('name="budgetCeilingUsd"')

    const ceiling = markup(
      <ConsentFacts repository={repository} modelProfiles={catalogue()} />,
    )
    expect(ceiling).toContain("Budget ceiling")
    expect(ceiling).toContain("40 USD ceiling")
  })
})
