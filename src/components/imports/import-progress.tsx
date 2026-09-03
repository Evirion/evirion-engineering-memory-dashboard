import type { RepositoryImport } from "@contracts/console"

import {
  type ProgressCount,
  costCompletenessLabel,
  costView,
  dispositionCounts,
  progressCounts,
} from "@/lib/imports/presentation"

/**
 * Progress and cost, both read from the backend aggregate and never computed.
 *
 * Two rules shape everything here. Rejected and quarantined are machine
 * outcomes rather than failures, so they are reported in their own group and
 * never beside the failed count. And an unresolved or inapplicable cost has no
 * amount at all rather than an amount of zero, because zero is a measurement.
 */

const card = "flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"

const CountList = ({
  counts,
  testId,
}: {
  counts: readonly ProgressCount[]
  testId: string
}) => (
  <dl data-testid={testId} className="grid gap-3 sm:grid-cols-3">
    {counts.map((count) => (
      <div key={count.label} className="flex flex-col gap-1">
        <dt className="text-xs font-medium tracking-wide text-slate-600 uppercase">
          {count.label}
        </dt>
        <dd
          data-testid={`count-${count.label.toLowerCase().replace(/\s+/g, "-")}`}
          className="text-lg text-slate-900 tabular-nums"
        >
          {count.value}
        </dd>
        <p className="text-xs text-slate-600">{count.detail}</p>
      </div>
    ))}
  </dl>
)

export const ImportProgress = ({ current }: { current: RepositoryImport }) => {
  const progress = progressCounts(current.counts)

  return (
    <section
      aria-labelledby="import-progress-heading"
      data-testid="import-progress"
      className={card}
    >
      <h2 id="import-progress-heading" className="text-sm font-semibold text-slate-900">
        Progress
      </h2>
      {/* `BF-004` asks for processed of total. The contract publishes neither
          field, so the relationship it does support is stated as the derivation
          it is rather than as a figure the backend sent. */}
      <p data-testid="import-progress-summary" className="text-sm text-slate-700">
        {progress.summary}
      </p>
      <CountList counts={progress.work} testId="import-work-counts" />

      <h3 className="text-sm font-semibold text-slate-900">Extraction outcomes</h3>
      <p className="text-sm text-slate-700">
        These are model decisions, not infrastructure failures. Only accepted work
        becomes Engineering Memory.
      </p>
      <CountList
        counts={dispositionCounts(current.dispositions)}
        testId="import-disposition-counts"
      />
    </section>
  )
}

export const ImportCost = ({ current }: { current: RepositoryImport }) => {
  const cost = costView(current.cost)

  return (
    <section
      aria-labelledby="import-cost-heading"
      data-testid="import-cost"
      data-cost-completeness={cost.completeness}
      className={card}
    >
      <h2 id="import-cost-heading" className="text-sm font-semibold text-slate-900">
        Cost
      </h2>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">Completeness</dt>
          <dd data-testid="cost-completeness" className="text-slate-900">
            {costCompletenessLabel(cost.completeness)}
          </dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">{cost.headline.label}</dt>
          {/* No amount is rendered as an explicit absence. An unresolved or
              inapplicable cost has no figure that could stand for it, and a
              zero would be a measurement nobody made. */}
          <dd data-testid="cost-headline" className="text-slate-900">
            {cost.headline.amount ?? "No amount to show"}
          </dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-slate-900">{cost.budget.label}</dt>
          <dd data-testid="cost-budget" className="text-slate-900">
            {cost.budget.amount ?? "Not set"}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-slate-700">{cost.headline.detail}</p>

      <dl className="grid gap-3 sm:grid-cols-3">
        {cost.figures.map((figure) => (
          <div key={figure.label} className="flex flex-col gap-1">
            <dt className="text-xs font-medium tracking-wide text-slate-600 uppercase">
              {figure.label}
            </dt>
            <dd
              data-testid={`cost-${figure.label.toLowerCase()}`}
              className="text-sm text-slate-900 tabular-nums"
            >
              {figure.amount ?? "No amount to show"}
            </dd>
            <p className="text-xs text-slate-600">{figure.detail}</p>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-600">
        These figures describe recorded usage. They are not an invoice.
      </p>
    </section>
  )
}
