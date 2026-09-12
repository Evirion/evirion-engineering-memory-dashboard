import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { UsageMetricsPanel } from "@/components/settings/usage-metrics-panel"
import { formatInstant } from "@/lib/format/display"

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
    expect(html).toContain(formatInstant(metrics.asOf))
    expect(html).not.toContain("123456")
    expect(html).toContain("not comparable")
  })

  /*
   * This asserted that an unresolved total renders as "No amount yet" rather
   * than a settled zero. Cost reporting on this panel was suspended on
   * 2026-09-08, so there is no total to inspect.
   *
   * It now holds the suspension instead, on the same unresolved fixture that
   * would have been the most likely thing to leak: a figure whose measured
   * component is a zero. That is a smaller claim than the one it replaces.
   * The rule itself still stands over `usageCostView` in
   * `tests/unit/settings/presentation.test.ts`, which is where it was always
   * decided; this row only ever checked that the panel rendered the decision.
   */
  it("renders no cost total while cost reporting is suspended", () => {
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
    expect(html).not.toMatch(/USD|No amount yet|Cost/)
  })
})
