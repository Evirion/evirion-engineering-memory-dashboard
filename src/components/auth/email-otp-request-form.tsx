"use client"

import { useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { Field, Input, Label } from "@/components/ui/field"

/**
 * Requests an email code. The response is identical for a known and an
 * unknown address, so nothing here can be used to enumerate accounts. The
 * code is never placed in a URL and never stored in the browser.
 */
export const EmailOtpRequestForm = ({
  csrfToken,
  invitationId = "",
}: {
  csrfToken: string
  /**
   * Present when the reader followed an invitation link. It selects the backend
   * sign-in path that an invited reader needs, because their membership is
   * still `invited` and the member path requires `active`.
   */
  invitationId?: string
}) => {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle")

  const handleSubmit = () => {
    setStatus("sending")
  }

  if (status === "sent") {
    return (
      <output className="text-sm text-ink-secondary">
        If that address has an invitation, a code is on its way.
      </output>
    )
  }

  return (
    <form
      action="/api/auth/request-otp"
      method="post"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      {invitationId ? (
        <input type="hidden" name="invitationId" value={invitationId} />
      ) : null}
      <Field className="gap-2">
        <Label htmlFor="email" className="text-sm">
          Email address
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
        />
      </Field>
      <button
        type="submit"
        disabled={status === "sending"}
        className={buttonVariants({ variant: "primary", size: "lg" })}
      >
        {status === "sending" ? "Sending" : "Send code"}
      </button>
    </form>
  )
}
