import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ProcessingActivityTable } from "@/components/processing/processing-activity-table"

import {
  PROCESSING_PAGE,
  PROCESSING_PAGE_VIEWER,
} from "../../../tools/console-stub/fixtures.mjs"

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe("processing activity table", () => {
  it("renders every outcome without a recovery control", () => {
    const html = markup(<ProcessingActivityTable page={PROCESSING_PAGE()} />)
    expect(html).toContain("Rejected by admission")
    expect(html).toContain("Quarantined")
    expect(html).toContain("Infrastructure failure")
    expect(html).not.toMatch(/>\s*Retry\s*</i)
    expect(html).not.toMatch(/>\s*Resume\s*</i)
    expect(html).not.toMatch(/recoveryAction/i)
  })

  it("keeps customer and Evirion authorization waits visually distinct", () => {
    const html = markup(<ProcessingActivityTable page={PROCESSING_PAGE()} />)
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
      const html = markup(<ProcessingActivityTable page={page} />)
      expect(html).not.toMatch(/USD|No amount yet|Pending reconciliation/)
      expect(html).not.toContain("Not included for your role")
    }
  })
})
