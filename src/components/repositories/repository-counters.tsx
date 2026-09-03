import type { RepositoryOverviewView } from "@/server/queries/repositories"

import { overviewGroups } from "@/lib/repositories/presentation"

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
        className="flex flex-col gap-2 rounded border border-slate-300 bg-slate-50 px-4 py-3"
      >
        <h2 className="text-sm font-semibold text-slate-900">Repository counters</h2>
        <p className="text-sm text-slate-700">
          These counters are unavailable right now. {view.failure.message} Nothing is
          shown as zero, because an unavailable count is not a count of zero.
        </p>
        <p className="text-xs text-slate-600">
          Reference {view.failure.code}
          {view.failure.requestId === undefined
            ? ""
            : `, request ${view.failure.requestId}`}
          .
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Repository counters" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-slate-900">Repository counters</h2>
        <p className="text-xs text-slate-600">
          Counted as of {view.overview.asOf}. Figures taken at different times are not
          comparable.
        </p>
      </div>

      {overviewGroups(view.overview).map((group) => (
        <section
          key={group.id}
          aria-label={group.heading}
          className="flex flex-col gap-2"
        >
          <h3 className="text-sm font-medium text-slate-900">{group.heading}</h3>
          <dl className="grid gap-3 sm:grid-cols-3">
            {group.counters.map((counter) => (
              <div key={counter.key} className="flex flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  {counter.label}
                </dt>
                <dd className="text-sm text-slate-900">{counter.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-600">{group.note}</p>
        </section>
      ))}
    </section>
  )
}
