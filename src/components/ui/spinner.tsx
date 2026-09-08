import type { ComponentProps } from "react"
import { LoaderIcon } from "lucide-react"
import { cn } from "cn"

/**
 * A mark that something is genuinely in flight.
 *
 * It is decorative, and deliberately so. The reference implementation puts
 * `role="status"` on the icon itself, which is right when the spinner is the
 * only thing on screen reporting the wait. Here it never is: a working button
 * keeps its label and carries `aria-busy`, a running chip carries the state
 * in words, and a poll sits beside its own `<output aria-live="polite">`.
 * Announcing the same event twice is worse than announcing it once, so the
 * glyph stays out of the accessibility tree and the text keeps the job.
 *
 * The rotation is a Tailwind keyframe, so the reduced-motion block in
 * `globals.css` stops it and leaves the glyph at rest. That is why the icon
 * is a marker that still reads as one when it is not turning.
 */
export const Spinner = ({ className, ...props }: ComponentProps<typeof LoaderIcon>) => (
  <LoaderIcon
    aria-hidden
    data-slot="spinner"
    className={cn("size-4 shrink-0 animate-spin", className)}
    strokeWidth={2}
    {...props}
  />
)
