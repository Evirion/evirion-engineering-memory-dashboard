import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PullRequestDetailPanel } from "@/components/processing/pull-request-detail"

import {
  PULL_REQUEST_DETAIL,
  VALIDATION_ISSUES,
} from "../../../tools/console-stub/fixtures.mjs"

/**
 * MEM-UX/07 — pull request detail cost line follows the suspension flag.
 */

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe("pull request detail cost disclosure", () => {
  it("renders no cost figure while cost reporting is suspended", () => {
    const issues = VALIDATION_ISSUES()
    const html = markup(
      <PullRequestDetailPanel
        detail={PULL_REQUEST_DETAIL()}
        validationIssues={{
          [issues.extractionRunId]: { status: "ready", issues },
        }}
      />,
    )

    expect(html).not.toContain('data-testid="pull-request-cost"')
    expect(html).not.toMatch(/USD|No amount yet|Cost not included/)
  })
})
