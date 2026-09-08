import type { ComponentProps, ReactNode } from "react"
import { cn } from "cn"

import { kickerClasses } from "./text"

/**
 * One published figure, with the question it answers above it.
 *
 * The value is mono and tabular so a column of figures lines up on the
 * decimal, which is the whole reason anyone reads these next to each other.
 * It is deliberately not boxed: a grid of bordered cards around single
 * numbers is more chrome than data, and the hairline grid below separates
 * them for a fraction of the ink.
 *
 * Nothing here ever substitutes a zero for an absent figure. A counter the
 * backend could not compute is not a counter of zero, so the caller passes
 * the words it wants and this renders them unchanged.
 */
export const Metric = ({
  label,
  value,
  detail,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  label: string
  value: ReactNode
  detail?: ReactNode
}) => (
  <div data-slot="metric" className={cn("flex flex-col gap-1", className)} {...props}>
    <dt className={kickerClasses()}>{label}</dt>
    <dd className="text-foreground font-mono text-lg font-semibold tabular-nums">
      {value}
    </dd>
    {detail === undefined ? null : (
      <dd className="text-muted-foreground text-xs leading-5">{detail}</dd>
    )}
  </div>
)

/**
 * The grid metrics sit in. Hairlines rather than cards, so a dozen figures
 * read as one table of facts instead of a dozen competing objects.
 *
 * The rules are borders on the cells rather than a `gap-px` over a tinted
 * container. That trick paints the container colour through any slot the last
 * row leaves empty, which shows up as a stray grey block whenever the count
 * is not a multiple of the column count. The trailing right and bottom
 * borders are pulled under the frame by a negative margin so the edge stays
 * one pixel.
 */
export const MetricGrid = ({ className, ...props }: ComponentProps<"dl">) => (
  <div className="border-border bg-card overflow-hidden rounded-2xl border">
    <dl
      data-slot="metric-grid"
      className={cn(
        "-mr-px -mb-px grid sm:grid-cols-2 lg:grid-cols-3",
        "[&>*]:border-border [&>*]:border-r [&>*]:border-b [&>*]:p-4",
        className,
      )}
      {...props}
    />
  </div>
)
