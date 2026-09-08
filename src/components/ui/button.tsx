import type { ComponentProps } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * The Console's controls.
 *
 * Interaction states read opaque tokens rather than an opacity on the base
 * fill, because a translucent hover takes its lightness from whatever surface
 * it happens to sit on, and the label contrast would then depend on the
 * panel behind the button. Every state here is measured by
 * `tools/verify/contrast.mjs`.
 *
 * `buttonVariants` is exported because most mutations in this Console are
 * native form posts and several controls are anchors; both need the same
 * surface without being forced through a React component.
 */
export const buttonVariants = cva(
  "tactile inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active shadow-panel",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        outline:
          "border-input bg-card text-foreground hover:bg-muted hover:border-line-strong shadow-panel",
        ghost: "text-ink-secondary hover:bg-muted hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover shadow-panel",
        link: "text-primary hover:text-primary-hover h-auto rounded-sm p-0 underline underline-offset-4",
      },
      size: {
        // A dense row keeps its 32px control on the grid and still receives a
        // 44px press, because the target is an invisible expander.
        sm: "hit-area h-8 px-3 text-xs",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-sm",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
)

export const Button = ({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => (
  <button
    data-slot="button"
    type={type}
    className={cn(buttonVariants({ variant, size }), className)}
    {...props}
  />
)
