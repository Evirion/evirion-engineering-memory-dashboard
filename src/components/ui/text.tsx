import type { ComponentProps } from "react"
import { cn } from "cn"

/**
 * The five type roles, as components rather than remembered class strings.
 *
 * Hierarchy comes from weight and colour before it comes from size. A page
 * heading that shouts is the commonest way a dense interface stops being
 * readable, so the largest thing on a Console page is 30px and the work of
 * separating levels is done by the three-rung text ladder.
 */

/**
 * Section eyebrow. Mono and letterspaced, so it reads as a label, not prose.
 *
 * The classes are exported separately because a kicker is very often the
 * `<dt>` of a description list, and nesting a paragraph inside the `<dt>`
 * would put a block between the term and its own text for no gain.
 */
export const kickerClasses = (className?: string): string =>
  cn(
    "text-muted-foreground font-mono text-xs font-medium tracking-[0.08em] uppercase",
    className,
  )

export const Kicker = ({ className, ...props }: ComponentProps<"p">) => (
  <p data-slot="kicker" className={kickerClasses(className)} {...props} />
)

export const PageTitle = ({ className, children, ...props }: ComponentProps<"h1">) => (
  <h1
    data-slot="page-title"
    className={cn(
      "text-foreground text-2xl font-semibold tracking-tight md:text-3xl",
      className,
    )}
    {...props}
  >
    {children}
  </h1>
)

export const SectionTitle = ({
  className,
  children,
  ...props
}: ComponentProps<"h2">) => (
  <h2
    data-slot="section-title"
    className={cn("text-foreground text-lg font-semibold tracking-tight", className)}
    {...props}
  >
    {children}
  </h2>
)

/**
 * The standfirst under a page title. Capped at a readable measure, because a
 * sentence running the full width of a 1280px canvas loses the reader on the
 * carriage return.
 */
export const Lede = ({ className, ...props }: ComponentProps<"p">) => (
  <p
    data-slot="lede"
    className={cn("text-ink-secondary max-w-[68ch] text-sm leading-6", className)}
    {...props}
  />
)

export const Prose = ({ className, ...props }: ComponentProps<"p">) => (
  <p
    data-slot="prose"
    className={cn("text-ink-secondary text-sm leading-6", className)}
    {...props}
  />
)

/**
 * Identifiers, versions, digests, timestamps, confidence and cost.
 *
 * Mono with tabular figures, because these are compared down a column far
 * more often than they are read as a sentence, and a proportional 1 against a
 * proportional 8 breaks the comparison.
 */
export const Technical = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="technical"
    className={cn("text-muted-foreground font-mono text-xs tabular-nums", className)}
    {...props}
  />
)

/** Page heading block: eyebrow, title, and an optional standfirst. */
export const PageHeader = ({ className, ...props }: ComponentProps<"header">) => (
  <header
    data-slot="page-header"
    className={cn("flex flex-col gap-2", className)}
    {...props}
  />
)
