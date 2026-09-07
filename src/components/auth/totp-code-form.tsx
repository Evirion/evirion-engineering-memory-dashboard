"use client"

import { useRef } from "react"

import { OtpCells } from "@/components/auth/otp-cells"

/**
 * The six digits from an authenticator app.
 *
 * The form submits itself once the sixth digit lands, because the digits are
 * only valid for the half-minute they are shown and asking for a second
 * deliberate act spends part of it. The button stays: it is the only affordance
 * for anyone who fills the field by a route that does not fire completion, and
 * it is what a keyboard reader reaches for.
 */
export const TotpCodeForm = ({
  action,
  csrfToken,
  label,
  submitLabel,
}: {
  action: string
  csrfToken: string
  label: string
  submitLabel: string
}) => {
  const form = useRef<HTMLFormElement>(null)

  return (
    <form ref={form} action={action} method="post" className="flex flex-col gap-4">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <div className="flex flex-col gap-2">
        <label htmlFor="totp" className="text-sm font-medium">
          {label}
        </label>
        <OtpCells
          id="totp"
          name="totp"
          onComplete={() => form.current?.requestSubmit()}
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {submitLabel}
      </button>
    </form>
  )
}
