import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { PullRequestDetail } from "@contracts/console"

import { PullRequestDetailPanel } from "@/components/processing/pull-request-detail"

import { PULL_REQUEST_DETAIL } from "../../../tools/console-stub/fixtures.mjs"

vi.mock("@/lib/ui/cost-reporting", () => ({ SHOW_COST_FIGURES: true }))

const markup = (detail: PullRequestDetail): string =>
  renderToStaticMarkup(<PullRequestDetailPanel detail={detail} validationIssues={{}} />)

describe("pull request detail cost restoration", () => {
  it("restores the amount when reporting is enabled", () => {
    expect(markup(PULL_REQUEST_DETAIL())).toContain('data-testid="pull-request-cost"')
  })

  it("restores the role-withheld message when reporting is enabled", () => {
    const { cost: _cost, ...withoutCost } = PULL_REQUEST_DETAIL()

    expect(markup(withoutCost)).toContain("Cost not included for your role")
  })
})
