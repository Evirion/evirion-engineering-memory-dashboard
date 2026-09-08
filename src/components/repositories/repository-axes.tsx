import type { Repository } from "@contracts/console"

import {
  type RepositoryAxis,
  accessAxis,
  entitlementAxis,
  policyAxis,
} from "@/lib/repositories/presentation"
import { StatusChip } from "@/components/ui/status-chip"
import { kickerClasses } from "@/components/ui/text"

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

/**
 * No axis value is ever green, and that restraint is what makes the card
 * work.
 *
 * Colour aggregates. Three green chips let the eye assemble "this repository
 * is fine" even when live processing is off and nothing is being processed —
 * the exact single-status failure the three separate slots exist to prevent,
 * only distributed. The one coloured thing on a card is the backend's own
 * rollup verdict, which cannot be aggregated because there is nothing to add
 * it to. The axes stay grey and explain it.
 */
export const RepositoryAxisValue = ({ axis }: { axis: RepositoryAxis }) => (
  <StatusChip tone={axis.tone}>{axis.value}</StatusChip>
)

export const RepositoryAxisList = ({ repository }: { repository: Repository }) => (
  <dl className="border-border grid gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-dashed">
    {repositoryAxes(repository).map((axis, index) => (
      <div
        key={axis.label}
        className={`flex flex-col items-start gap-1.5 ${index === 0 ? "sm:pr-4" : "sm:px-4"}`}
      >
        <dt className={kickerClasses()}>{axis.label}</dt>
        <dd className="flex flex-col items-start gap-1.5">
          <RepositoryAxisValue axis={axis} />
          <span className="text-muted-foreground text-xs leading-5">{axis.detail}</span>
        </dd>
      </div>
    ))}
  </dl>
)
