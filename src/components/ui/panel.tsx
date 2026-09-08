import type { ComponentProps } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import type { Tone } from "@/lib/ui/tone"

/**
 * The document surface.
 *
 * One elevation step, and depth is not used as a hierarchy device: a panel is
 * raised because it is a distinct object on the canvas, never because it
 * matters more than the panel beside it. The shadow is tinted from Midnight
 * rather than black so a lifted panel reads as floating above this cool
 * canvas instead of smudged onto it.
 */
export const panelVariants = cva("rounded-2xl", {
  variants: {
    variant: {
      raised: "bg-card border-border shadow-panel border",
      sunken: "bg-muted border-border border",
      inverse: "bg-surface-inverse text-ink-inverse",
      flush: "",
    },
    padding: {
      none: "",
      compact: "px-4 py-3",
      default: "p-5",
      roomy: "p-6 sm:p-8",
    },
  },
  defaultVariants: {
    variant: "raised",
    padding: "default",
  },
})

export const Panel = ({
  className,
  variant,
  padding,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof panelVariants>) => (
  <div
    data-slot="panel"
    className={cn(panelVariants({ variant, padding }), className)}
    {...props}
  />
)

export const PanelHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="panel-header"
    className={cn("flex flex-wrap items-start justify-between gap-3", className)}
    {...props}
  />
)

export const PanelTitle = ({ className, children, ...props }: ComponentProps<"h2">) => (
  <h2
    data-slot="panel-title"
    className={cn("text-base font-semibold tracking-tight", className)}
    {...props}
  >
    {children}
  </h2>
)

/**
 * A notice is a panel that has taken a side.
 *
 * The 3px left edge is the signal, not the tint: it survives greyscale, it
 * reads at the edge of vision while scanning a column of panels, and it is
 * the same device the `holding` chip uses, so a panel and the chip inside it
 * agree about who is being waited on.
 */
const noticeSurface = (tone: Tone): string => {
  switch (tone) {
    case "verified":
      return "bg-tone-verified-fill border-tone-verified-border text-tone-verified-text"
    case "attention":
      return "bg-tone-attention-fill border-tone-attention-border text-tone-attention-text"
    case "rejected":
      return "bg-tone-rejected-fill border-tone-rejected-border text-tone-rejected-text"
    case "progress":
      return "bg-tone-progress-fill border-tone-progress-border text-tone-progress-text"
    case "holding":
      return "bg-tone-holding-fill border-tone-holding-border text-tone-holding-text"
    case "neutral":
      return "bg-tone-neutral-fill border-tone-neutral-border text-tone-neutral-text"
    case "unknown":
      return "bg-tone-unknown-fill border-tone-unknown-border text-tone-unknown-text border-dashed"
    default: {
      const exhaustive: never = tone
      throw new Error(`unhandled tone: ${String(exhaustive)}`)
    }
  }
}

/**
 * Exported as classes as well as a component, because most outcomes in this
 * Console are already an `<output aria-live="polite">` and wrapping one in a
 * styled div would put the border on a different element than the live
 * region. The caller keeps its own tag and takes the surface.
 *
 * The edge is one pixel on every tone but `holding`. An earlier cut gave all
 * seven the 3px left bar, which was wrong twice over: it spends the one piece
 * of border geometry the system reserves for "blocked on an Evirion decision"
 * on notices that mean nothing of the kind, and against a 22px corner radius
 * the thick side tapers into the thin one and reads as a smear rather than a
 * bar.
 */
export const noticeClasses = (tone: Tone, className?: string): string =>
  cn(
    "rounded-2xl border px-4 py-3 text-sm",
    tone === "holding" && "border-l-[3px]",
    noticeSurface(tone),
    className,
  )

export const Notice = ({
  tone,
  className,
  ...props
}: ComponentProps<"div"> & { tone: Tone }) => (
  <div
    data-slot="notice"
    data-tone={tone}
    className={noticeClasses(tone, className)}
    {...props}
  />
)
