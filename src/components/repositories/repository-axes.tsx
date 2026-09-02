import type { Repository } from "@contracts/console"

import {
  type RepositoryAxis,
  accessAxis,
  entitlementAxis,
  policyAxis,
} from "@/lib/repositories/presentation"

/**
 * The three axes, always three.
 *
 * They are independent, so they are rendered as three labelled slots rather
 * than folded into one status. Each carries its own text value, so the state
 * is readable without colour and by a screen reader.
 */
export const repositoryAxes = (repository: Repository): readonly RepositoryAxis[] => [
  accessAxis(repository),
  entitlementAxis(repository),
  policyAxis(repository),
]

export const RepositoryAxisValue = ({ axis }: { axis: RepositoryAxis }) => (
  <span
    className={
      axis.tone === "attention"
        ? "inline-flex rounded border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900"
        : "inline-flex rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-800"
    }
  >
    {axis.value}
  </span>
)

export const RepositoryAxisList = ({ repository }: { repository: Repository }) => (
  <dl className="grid gap-3 sm:grid-cols-3">
    {repositoryAxes(repository).map((axis) => (
      <div key={axis.label} className="flex flex-col gap-1">
        <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {axis.label}
        </dt>
        <dd className="flex flex-col gap-1">
          <RepositoryAxisValue axis={axis} />
          <span className="text-xs text-slate-600">{axis.detail}</span>
        </dd>
      </div>
    ))}
  </dl>
)
