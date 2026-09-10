import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  ProcessingActivityTable,
  ProcessingPagination,
} from "@/components/processing/processing-activity-table"

import {
  PROCESSING_JOBS,
  PROCESSING_PAGE,
  PROCESSING_PAGE_VIEWER,
} from "../../../tools/console-stub/fixtures.mjs"

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

const table = (page = PROCESSING_PAGE()) => (
  <ProcessingActivityTable page={page} query={{}} />
)

describe("processing activity table", () => {
  it("splits repository and pull request into two columns", () => {
    const html = markup(table())
    expect(html).toContain('scope="col"')
    expect(html).toContain(">Repository<")
    expect(html).toContain(">PR<")
    expect(html).not.toContain("Repository / PR")
  })

  it("orders a column through a shareable sort link", () => {
    const html = markup(
      <ProcessingActivityTable
        page={PROCESSING_PAGE()}
        query={{ repositoryId: "00000000-0000-4000-8000-0000000000c4" }}
      />,
    )
    expect(html).toContain("sort=pullRequest")
    expect(html).toContain("dir=asc")
    expect(html).toContain("repositoryId=00000000-0000-4000-8000-0000000000c4")
    expect(html).not.toContain("pageSize=")
  })

  it("renders every outcome without a recovery control", () => {
    const html = markup(table())
    expect(html).toContain("Rejected by admission")
    expect(html).toContain("Quarantined")
    expect(html).toContain("Infrastructure failure")
    expect(html).not.toMatch(/>\s*Retry\s*</i)
    expect(html).not.toMatch(/>\s*Resume\s*</i)
    expect(html).not.toMatch(/recoveryAction/i)
  })

  it("keeps customer and Evirion authorization waits visually distinct", () => {
    const html = markup(table())
    expect(html).toContain("Waiting for your approval")
    expect(html).toContain("Waiting for Evirion authorization")
  })

  /*
   * Two rows stood here: an unresolved figure never rendering as a measured
   * zero, and an absent figure reading as absence for a viewer. Both read the
   * cost column, and both went with it when cost reporting was suspended on
   * 2026-09-08.
   *
   * What replaces them is narrower, and worth being plain about. It proves
   * the suspension is complete on both fixtures — no amount, and no leftover
   * completeness wording — which is what catches a restore that puts the
   * column back carelessly. It cannot prove the completeness rule itself any
   * more, because nothing here renders completeness. That rule is still
   * proved on the import surface by "never renders an unresolved cost as
   * zero" in `tests/e2e/import.spec.ts`, and over `costView` in
   * `tests/unit/imports/presentation.test.ts`. Restoring the column should
   * bring these two rows back beside those, not instead of them.
   */
  it("renders no cost figure while cost reporting is suspended", () => {
    for (const page of [PROCESSING_PAGE(), PROCESSING_PAGE_VIEWER()]) {
      const html = markup(<ProcessingActivityTable page={page} query={{}} />)
      expect(html).not.toMatch(/USD|No amount yet|Pending reconciliation/)
      expect(html).not.toContain("Not included for your role")
    }
  })
})

describe("the processing cursor control", () => {
  it("is absent when the backend reports no next page", () => {
    expect(markup(<ProcessingPagination page={PROCESSING_PAGE()} query={{}} />)).toBe(
      "",
    )
  })

  it("follows the backend cursor and keeps the predicates", () => {
    const html = markup(
      <ProcessingPagination
        page={{
          items: PROCESSING_PAGE().items,
          page: { nextCursor: PROCESSING_JOBS.rejected },
        }}
        query={{
          repositoryId: "00000000-0000-4000-8000-0000000000c4",
          sort: "pullRequest",
          dir: "asc",
        }}
      />,
    )

    expect(html).toContain(`after=${PROCESSING_JOBS.rejected}`)
    expect(html).toContain("repositoryId=00000000-0000-4000-8000-0000000000c4")
    expect(html).toContain("sort=pullRequest")
    expect(html).toContain("Next processing rows")
    expect(html).not.toContain("pageSize=")
  })
})
