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
