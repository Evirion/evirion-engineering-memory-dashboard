import type { RepositoryOverviewView } from "@/server/queries/repositories"

import { overviewGroups } from "@/lib/repositories/presentation"
import { Metric, MetricGrid } from "@/components/ui/metric"
import { noticeClasses } from "@/components/ui/panel"
import { Kicker, SectionTitle, Technical } from "@/components/ui/text"

/**
 * The `REPO-003` counters, owned by EEM-9/06 and rendered on an EEM-9/03 page.
 *
 * Two rules decide everything here.
 *
 * An unavailable aggregate never renders as `0`. The schema requires every
 * counter, so a counter the backend could not compute cannot be represented and
 * fails validation instead; the whole block is then unavailable and says so. A
 * number that reaches this component is therefore always a real count, and a
 * zero always means zero.
 *
 * The cutoff is shown rather than hidden. Two figures taken at different `asOf`
 * values are not comparable, so the page states the one it rendered.
 */
export const RepositoryCounters = ({ view }: { view: RepositoryOverviewView }) => {
  if (view.status === "unavailable") {
    return (
      <section
        aria-label="Repository counters"
        className={noticeClasses("unknown", "flex flex-col gap-2")}
      >
        <SectionTitle className="text-base">Repository counters</SectionTitle>
        <p className="text-sm leading-6">
          These counters are unavailable right now. {view.failure.message} Nothing is
          shown as zero, because an unavailable count is not a count of zero.
        </p>
        <Technical>
          Reference {view.failure.code}
          {view.failure.requestId === undefined
            ? ""
            : `, request ${view.failure.requestId}`}
          .
        </Technical>
      </section>
    )
  }

  return (
    <section aria-label="Repository counters" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <SectionTitle>Repository counters</SectionTitle>
        {/*
          The cutoff travels with the figures. Two counts taken at different
          `asOf` values are not comparable, and a reader cannot know that
          unless the page says which one it rendered.
        */}
        <Technical>
          Counted as of {view.overview.asOf}. Figures taken at different times are not
          comparable.
        </Technical>
      </div>

      {overviewGroups(view.overview).map((group) => (
        <section
          key={group.id}
          aria-label={group.heading}
          className="flex flex-col gap-3"
        >
          <Kicker>{group.heading}</Kicker>
          <MetricGrid>
            {group.counters.map((counter) => (
              <Metric key={counter.key} label={counter.label} value={counter.value} />
            ))}
          </MetricGrid>
          <p className="text-muted-foreground max-w-[68ch] text-xs leading-5">
            {group.note}
          </p>
        </section>
      ))}
    </section>
  )
}
