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
 * Section eyebrow.
 *
 * Sans, not mono. An earlier cut set these in Geist Mono, and small uppercase
 * mono at 12px reads tall and soft — the letterforms are drawn for a fixed
 * advance width, which is worth paying for in a column of identifiers and
 * costs a lot of clarity in a two-word heading. It is also the wrong role:
 * the Brand Book puts navigation and status labels in the interface font and
 * reserves mono for identifiers, versions, timestamps and confidence, which
 * is what `Technical` is for.
 *
 * Semibold with tighter tracking so the words separate at this size, and the
 * secondary ink rather than the tertiary so a section heading is not fainter
 * than the links beneath it.
 *
 * The classes are exported separately because a kicker is very often the
 * `<dt>` of a description list, and nesting a paragraph inside the `<dt>`
 * would put a block between the term and its own text for no gain.
 */
export const kickerClasses = (className?: string): string =>
  cn(
    "text-ink-secondary text-[0.6875rem] font-semibold tracking-[0.06em] uppercase",
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
