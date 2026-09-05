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

  it("never renders unresolved cost as a measured zero", () => {
    const html = markup(<ProcessingActivityTable page={PROCESSING_PAGE()} />)
    expect(html).toContain("No amount yet")
    expect(html).toContain("Pending reconciliation")
    expect(html).not.toContain("USD 0.000000")
  })

  it("treats absent cost as absence for viewers", () => {
    const html = markup(<ProcessingActivityTable page={PROCESSING_PAGE_VIEWER()} />)
    expect(html).toContain("Not included for your role")
    expect(html).not.toContain("USD ")
  })
})
