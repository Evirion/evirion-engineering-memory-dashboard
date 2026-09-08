import type { ComponentProps } from "react"
import { cn } from "cn"

/**
 * A table is used where every row answers the same scalar questions and
 * comparing rows down a column is the task. Where a row carries a sentence,
 * or more than two independent axes, it is a card instead — a table header
 * there would imply one status column when there are three, and would either
 * truncate the sentence or wreck the column rhythm.
 *
 * 14/24 text with 12px cell padding lands rows on 48px, which keeps the 8pt
 * vertical rhythm intact all the way down a long table.
 */

export const TableFrame = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="table-frame"
    className={cn(
      "border-border bg-card shadow-panel overflow-x-auto rounded-2xl border",
      className,
    )}
    {...props}
  />
)

export const Table = ({ className, ...props }: ComponentProps<"table">) => (
  <table
    data-slot="table"
    className={cn("w-full caption-bottom border-collapse text-sm", className)}
    {...props}
  />
)

export const TableHead = ({ className, ...props }: ComponentProps<"thead">) => (
  <thead
    data-slot="table-head"
    className={cn("bg-muted border-border border-b", className)}
    {...props}
  />
)

export const TableBody = ({ className, ...props }: ComponentProps<"tbody">) => (
  <tbody
    data-slot="table-body"
    className={cn("divide-border divide-y", className)}
    {...props}
  />
)

export const TableRow = ({ className, ...props }: ComponentProps<"tr">) => (
  <tr
    data-slot="table-row"
    className={cn("hover:bg-muted/60 transition-colors", className)}
    {...props}
  />
)

export const TableHeader = ({ className, ...props }: ComponentProps<"th">) => (
  <th
    data-slot="table-header"
    className={cn(
      "text-muted-foreground px-3 py-3 text-left font-mono text-xs font-medium tracking-[0.08em] whitespace-nowrap uppercase",
      className,
    )}
    {...props}
  />
)

export const TableCell = ({ className, ...props }: ComponentProps<"td">) => (
  <td
    data-slot="table-cell"
    className={cn("text-ink-secondary px-3 py-3 align-top", className)}
    {...props}
  />
)
