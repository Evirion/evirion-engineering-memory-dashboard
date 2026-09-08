"use client"

import { useRef } from "react"

import { OtpCells } from "@/components/auth/otp-cells"
import { buttonVariants } from "@/components/ui/button"
import { Field, Input, Label } from "@/components/ui/field"
import { SubmitButton } from "@/components/ui/submit-button"

/**
 * Submits the emailed code to the BFF. The code goes in a form body, never in
 * a URL, and the browser stores nothing: verification happens server-side and
 * the resulting tokens stay in `__Host-` cookies the browser cannot read.
 *
 * The field is the shared one, so every screen that asks for a code asks the
 * same way. It draws six cells from a single input, which is what the earlier
 * wide-tracking box was protecting: pasting from the mail client, the
 * `one-time-code` autofill and one announced field all still work.
 */
export const OtpVerifyForm = ({
  csrfToken,
  email = "",
  invitationId = "",
}: {
  csrfToken: string
  /** Carried from the invitation link so the invited path runs. */
  invitationId?: string
  /**
   * Read from the sealed pre-auth cookie. When it is known the address is shown
   * rather than asked for, and travels in a hidden field; the server still
   * checks it against the HMAC the proof is bound to. When it is missing — an
   * expired or cleared transaction — the field comes back and the reader types
   * it, which is how this worked before.
   */
  email?: string
}) => {
  const form = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={form}
      action="/api/auth/verify-otp"
      method="post"
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      {invitationId ? (
        <input type="hidden" name="invitationId" value={invitationId} />
      ) : null}

      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <Field className="gap-2">
          <Label htmlFor="email" className="text-sm">
            Email address
          </Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="code" className="text-sm">
          Six-digit code
        </Label>
        <OtpCells
          id="code"
          name="code"
          describedBy="code-hint"
          // Only when the address is already carried. With the field visible the
          // reader may still be filling it, and submitting on the sixth digit
          // would meet a validation error they did not ask for.
          {...(email ? { onComplete: () => form.current?.requestSubmit() } : {})}
        />
        <p id="code-hint" className="text-xs text-muted-foreground">
          Only the most recent code works. Asking for a new one cancels the previous
          code.
        </p>
      </div>

      <SubmitButton className={buttonVariants({ variant: "primary", size: "lg" })}>
        Verify and continue
      </SubmitButton>
    </form>
  )
}
