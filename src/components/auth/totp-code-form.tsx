"use client"

import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useRef } from "react"

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

const SLOTS = [0, 1, 2, 3, 4, 5]

/**
 * The six digits from an authenticator app.
 *
 * Six visible cells over one real input: `input-otp` renders the cells from a
 * single field, so pasting a code, the `one-time-code` autofill offered above
 * the keyboard, and a screen reader announcing one field all keep working.
 * Six separate inputs would break all three.
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
        <InputOTP
          id="totp"
          name="totp"
          maxLength={6}
          required
          pattern={REGEXP_ONLY_DIGITS}
          autoComplete="one-time-code"
          onComplete={() => form.current?.requestSubmit()}
          containerClassName="gap-3"
        >
          <InputOTPGroup className="gap-3">
            {SLOTS.map((slot) => (
              <InputOTPSlot
                key={slot}
                index={slot}
                className="size-14 rounded-lg border border-slate-300 bg-white text-2xl font-semibold text-slate-900 first:rounded-lg last:rounded-lg data-[active=true]:border-slate-900 data-[active=true]:ring-slate-900/20"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
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
