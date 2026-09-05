import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { UsageMetricsPanel } from "@/components/settings/usage-metrics-panel"

import {
  ORGANIZATION_METRICS,
  ORGANIZATION_USAGE,
} from "../../../tools/console-stub/fixtures.mjs"

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe("usage and metrics panel", () => {
  it("labels both sections and states neither is an invoice", () => {
    const html = markup(
      <UsageMetricsPanel
        usage={ORGANIZATION_USAGE()}
        metrics={ORGANIZATION_METRICS()}
      />,
    )
    expect(html).toContain('aria-label="Operational usage"')
    expect(html).toContain('aria-label="Alpha metrics"')
    expect(html).toContain("not an invoice")
  })

  it("renders the metrics window note beside asOf", () => {
    const metrics = ORGANIZATION_METRICS()
    const html = markup(
      <UsageMetricsPanel usage={ORGANIZATION_USAGE()} metrics={metrics} />,
    )
    expect(html).toContain(metrics.asOf)
    expect(html).toContain("not comparable")
  })

  it("never renders unresolved totals as a settled zero", () => {
    const usage = {
      ...ORGANIZATION_USAGE(),
      cost: {
        completeness: "UNRESOLVED" as const,
        measuredUsd: "0.000000",
        reservedUsd: "0.000000",
        unresolvedUsd: "2.000000",
      },
    }
    const html = markup(
      <UsageMetricsPanel usage={usage} metrics={ORGANIZATION_METRICS()} />,
    )
    expect(html).toContain("No amount yet")
    expect(html).not.toContain("USD 0.000000")
  })
})
