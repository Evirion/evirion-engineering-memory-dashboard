import type { ComponentProps, ReactNode } from "react"
import { ArrowUp, Check, CircleQuestionMark, Minus, Pause, X } from "lucide-react"
import { cn } from "cn"

import type { Tone } from "@/lib/ui/tone"
import { Spinner } from "./spinner"

/**
 * Colour is never the only signal.
 *
 * Every chip carries its state four ways — the words, a glyph, a fill and an
 * edge — so the meaning survives greyscale, a colour-vision deficiency and a
 * monochrome print. SC 1.4.1 asks for the first two; the two tones most
 * easily mistaken for an ordinary state change their border *geometry* as
 * well, because those are the two a reader most needs to tell apart at a
 * glance:
 *
 * - `holding` gains a 3px left bar, the same edge its panel carries.
 * - `unknown` goes dashed, so an unrecognised state can never be misread as a
 *   settled one.
 */
const toneSurface = (tone: Tone): string => {
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
      return "bg-tone-holding-fill border-tone-holding-border text-tone-holding-text border-l-[3px]"
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

const toneGlyphColour = (tone: Tone): string => {
  switch (tone) {
    case "verified":
      return "text-tone-verified-icon"
    case "attention":
      return "text-tone-attention-icon"
    case "rejected":
      return "text-tone-rejected-icon"
    case "progress":
      return "text-tone-progress-icon"
    case "holding":
      return "text-tone-holding-icon"
    case "neutral":
      return "text-tone-neutral-icon"
    case "unknown":
      return "text-tone-unknown-icon"
    default: {
      const exhaustive: never = tone
      throw new Error(`unhandled tone: ${String(exhaustive)}`)
    }
  }
}

const ToneGlyph = ({ tone }: { tone: Tone }) => {
  const className = cn("size-3.5 shrink-0", toneGlyphColour(tone))
  switch (tone) {
    case "verified":
      return <Check aria-hidden className={className} strokeWidth={2} />
    case "attention":
      return <ArrowUp aria-hidden className={className} strokeWidth={2} />
    case "rejected":
      return <X aria-hidden className={className} strokeWidth={2} />
    /*
     * The one tone that moves. `progress` is defined as automated work that
     * is running and will finish on its own, so a turning glyph reports
     * something true rather than decorating the chip — which is the whole
     * distinction between this and a thinking indicator. `holding` sits
     * still beside it on purpose: nothing is running there, and a spinner
     * would promise a completion that is not coming.
     */
    case "progress":
      return <Spinner className={className} />
    case "holding":
      return <Pause aria-hidden className={className} strokeWidth={2} />
    case "neutral":
      return <Minus aria-hidden className={className} strokeWidth={2} />
    case "unknown":
      return <CircleQuestionMark aria-hidden className={className} strokeWidth={2} />
    default: {
      const exhaustive: never = tone
      throw new Error(`unhandled tone: ${String(exhaustive)}`)
    }
  }
}

/**
 * A status chip.
 *
 * Rectangular at 4px rather than a pill, which is what keeps the surface
 * reading as an engineering instrument instead of a consumer app, and what
 * lets the `holding` left bar register as a bar at all.
 */
export const StatusChip = ({
  tone,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone: Tone; children: ReactNode }) => (
  <span
    data-slot="status-chip"
    data-tone={tone}
    className={cn(
      // `whitespace-nowrap`: a chip is one state, and breaking its label
      // across two lines makes a table cell read as two states.
      "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
      toneSurface(tone),
      className,
    )}
    {...props}
  >
    <ToneGlyph tone={tone} />
    {children}
  </span>
)

/**
 * The verdict a card is scanned by, rendered heavier than the chips that
 * explain it so the eye reaches it first.
 */
export const StatusBadge = ({
  tone,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone: Tone; children: ReactNode }) => (
  <StatusChip
    tone={tone}
    className={cn("px-2.5 py-1 text-xs font-semibold", className)}
    {...props}
  >
    {children}
  </StatusChip>
)
