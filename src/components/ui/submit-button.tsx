"use client"

import type { ComponentProps } from "react"
import { useEffect, useRef, useState } from "react"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { buttonVariants } from "./button"
import { Spinner } from "./spinner"

/**
 * A submit control that says it is working.
 *
 * Every mutation in this Console is a native form post to a route handler,
 * which navigates the whole page. The browser's own tab throbber is the only
 * feedback that gives, and on a slow backend a customer reasonably concludes
 * nothing happened and presses again. Idempotency keys keep the second press
 * harmless at the backend; they do nothing about the interface looking dead.
 *
 * `useFormStatus` is not available here. It reports on a React Server Action,
 * and these forms post to `/api/…` behind the frozen CSRF, origin and
 * content-type boundary. Converting them would move a security boundary to
 * buy a spinner. So this listens to its own form's `submit` event instead,
 * which also catches Enter in a text field and the programmatic
 * `requestSubmit()` the OTP field uses on the sixth digit.
 *
 * **It does not set `disabled`.** Two buttons on `/settings/sessions` carry
 * `name="selection"` with different values, so the submitter is load-bearing
 * there, and a disabled control is skipped when the browser builds the form
 * data — the request would arrive without the value that says which sessions
 * to end. The re-entry guard below stops the double submit instead, and
 * `pointer-events-none` stops the second click reaching it at all.
 *
 * The label stays. A button that blanks its own text while working removes
 * the only thing telling the reader what is running.
 */
export const SubmitButton = ({
  className,
  variant,
  size,
  children,
  onClick,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
  const button = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const control = button.current
    const form = control?.form
    if (!control || !form) return undefined

    const handleSubmit = (event: SubmitEvent) => {
      // Another submitter in the same form is another button's business.
      if (event.submitter !== null && event.submitter !== control) return
      if (pending) {
        event.preventDefault()
        return
      }
      setPending(true)
    }

    /*
     * Back-forward cache restores the page exactly as it was left, spinner
     * included, so a reader who navigates back finds a control that claims to
     * be working and refuses to submit.
     */
    const handleRestore = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false)
    }

    form.addEventListener("submit", handleSubmit)
    window.addEventListener("pageshow", handleRestore)
    return () => {
      form.removeEventListener("submit", handleSubmit)
      window.removeEventListener("pageshow", handleRestore)
    }
  }, [pending])

  return (
    <button
      ref={button}
      type="submit"
      data-slot="submit-button"
      aria-busy={pending}
      className={cn(
        buttonVariants({ variant, size }),
        pending && "pointer-events-none opacity-70",
        className,
      )}
      onClick={onClick}
      {...props}
    >
      {/*
        The label stays beside it. `aria-busy` on the button is what tells a
        screen reader; the glyph is out of the accessibility tree so the one
        event is announced once.
      */}
      {pending ? <Spinner /> : null}
      {children}
    </button>
  )
}
