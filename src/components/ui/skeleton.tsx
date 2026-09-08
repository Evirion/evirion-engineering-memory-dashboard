import type { ComponentProps } from "react"
import { cn } from "cn"

import { Panel } from "./panel"

/**
 * A placeholder, never a spinner.
 *
 * The structure of every list and detail route here is known before the data
 * arrives, so the placeholder can hold the exact box the content will occupy
 * and nothing shifts when it lands. A spinner communicates only that
 * something is happening, which the reader already knows.
 *
 * Each skeleton keeps a polite live region beside it, because a sighted
 * reader sees the shimmer and a screen reader user would otherwise be told
 * nothing at all.
 */
export const SkeletonLine = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="skeleton-line"
    className={cn("skeleton h-4 rounded-sm", className)}
    {...props}
  />
)

export const SkeletonPanel = ({ lines = 3 }: { lines?: number }) => (
  <Panel className="flex flex-col gap-3" aria-hidden>
    <SkeletonLine className="h-5 w-2/5" />
    {Array.from({ length: lines }, (_, index) => (
      <SkeletonLine key={index} className={index === lines - 1 ? "w-3/5" : "w-full"} />
    ))}
  </Panel>
)

export const SkeletonList = ({ rows = 4, label }: { rows?: number; label: string }) => (
  <div className="flex flex-col gap-4">
    <output aria-live="polite" className="sr-only">
      {label}
    </output>
    {Array.from({ length: rows }, (_, index) => (
      <SkeletonPanel key={index} lines={2} />
    ))}
  </div>
)

/**
 * The shape a table route will occupy: a header band over evenly spaced rows.
 * Matching the real row height is the point — a placeholder that guesses it
 * moves the content the moment the data lands, which is the shift a skeleton
 * exists to prevent.
 */
export const SkeletonTable = ({
  rows = 5,
  columns = 4,
  label,
}: {
  rows?: number
  columns?: number
  label: string
}) => (
  <div className="border-border bg-card shadow-panel overflow-hidden rounded-2xl border">
    <output aria-live="polite" className="sr-only">
      {label}
    </output>
    <div className="bg-muted border-border flex gap-4 border-b px-3 py-3">
      {Array.from({ length: columns }, (_, index) => (
        <SkeletonLine key={index} className="h-3 flex-1" />
      ))}
    </div>
    <div className="divide-border divide-y" aria-hidden>
      {Array.from({ length: rows }, (_unusedRow, row) => (
        <div key={row} className="flex gap-4 px-3 py-4">
          {Array.from({ length: columns }, (_unusedCell, column) => (
            <SkeletonLine key={column} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  </div>
)

/** The hairline grid the published figures land in. */
export const SkeletonMetrics = ({
  cells = 6,
  label,
}: {
  cells?: number
  label: string
}) => (
  <div className="border-border bg-card overflow-hidden rounded-2xl border">
    <output aria-live="polite" className="sr-only">
      {label}
    </output>
    <div className="-mr-px -mb-px grid sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: cells }, (_, index) => (
        <div
          key={index}
          className="border-border flex flex-col gap-2 border-r border-b p-4"
        >
          <SkeletonLine className="h-3 w-2/3" />
          <SkeletonLine className="h-5 w-1/3" />
        </div>
      ))}
    </div>
  </div>
)
