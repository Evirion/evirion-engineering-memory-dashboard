import type { ComponentProps } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"

/**
 * Form controls.
 *
 * The select is the native element, deliberately. It brings the platform's
 * own keyboard handling, type-ahead and mobile picker, none of which then has
 * to be rebuilt or tested, and it adds no dependency to a manifest where
 * every version is pinned and audited. A floating-listbox component would
 * buy a custom-styled popup and owe all of that back.
 *
 * Layout follows one rule everywhere: label above the control, hint below the
 * label, error below the control. The error is a sibling of the input rather
 * than a tooltip, so it survives zoom and is reached by the same traversal
 * that reaches the field.
 */

export const Field = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="field"
    className={cn("flex flex-col gap-1.5", className)}
    {...props}
  />
)

/**
 * `htmlFor` is required rather than optional. Every control in this Console
 * is a native form element posted to a route handler, so each one already has
 * an `id` to bind to, and an unbound label is the defect this type prevents
 * rather than reports.
 */
export const Label = ({
  className,
  children,
  htmlFor,
  ...props
}: ComponentProps<"label"> & { htmlFor: string }) => (
  <label
    data-slot="label"
    htmlFor={htmlFor}
    className={cn("text-foreground text-xs font-medium tracking-[0.01em]", className)}
    {...props}
  >
    {children}
  </label>
)

export const FieldHint = ({ className, ...props }: ComponentProps<"p">) => (
  <p
    data-slot="field-hint"
    className={cn("text-muted-foreground text-xs leading-4", className)}
    {...props}
  />
)

export const FieldError = ({ className, ...props }: ComponentProps<"p">) => (
  <p
    data-slot="field-error"
    className={cn("text-destructive text-xs leading-4", className)}
    {...props}
  />
)

const controlSurface =
  "border-input bg-card text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 text-sm transition-colors outline-none hover:border-line-strong focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive"

export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input data-slot="input" className={cn(controlSurface, className)} {...props} />
)

export const Textarea = ({ className, ...props }: ComponentProps<"textarea">) => (
  <textarea
    data-slot="textarea"
    className={cn(controlSurface, "h-auto min-h-24 py-2 leading-6", className)}
    {...props}
  />
)

/**
 * The chevron is decorative and the native one is suppressed, so the control
 * keeps one affordance instead of two. The wrapper carries the arrow rather
 * than a background image, which keeps the glyph on the token colour and
 * lets it follow the disabled state.
 */
export const Select = ({ className, children, ...props }: ComponentProps<"select">) => (
  <div className="relative">
    <select
      data-slot="select"
      className={cn(controlSurface, "cursor-pointer appearance-none pr-9", className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden
      className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      strokeWidth={1.5}
    />
  </div>
)
