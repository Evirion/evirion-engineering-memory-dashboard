"use client"

import { REGEXP_ONLY_DIGITS } from "input-otp"

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

const SLOTS = [0, 1, 2, 3, 4, 5]

/**
 * The one way this product asks for a six-digit code.
 *
 * Six visible cells over one real input: `input-otp` draws the cells from a
 * single field, so pasting a code out of the mail client, the `one-time-code`
 * autofill offered above the keyboard, and a screen reader announcing one field
 * all keep working. Six separate inputs break all three, which is why the
 * earlier wide-tracking box existed; the cells reach the same place without
 * giving that up.
 *
 * The border is deliberately heavy. Three screens ask for a code, and on each
 * of them it is the only thing to do, so the field should be the first thing
 * the eye lands on rather than a pale outline the reader has to hunt for.
 */
export const OtpCells = ({
  id,
  name,
  describedBy,
  onComplete,
}: {
  id: string
  name: string
  describedBy?: string
  onComplete?: () => void
}) => (
  <InputOTP
    id={id}
    name={name}
    maxLength={6}
    required
    pattern={REGEXP_ONLY_DIGITS}
    autoComplete="one-time-code"
    // Spread rather than passed: `exactOptionalPropertyTypes` refuses an
    // explicit `undefined` where the prop is merely optional.
    {...(describedBy === undefined ? {} : { "aria-describedby": describedBy })}
    {...(onComplete === undefined ? {} : { onComplete })}
    // The real input is laid over the cells here rather than left to the
    // library's own inline styles, which did not take effect: it rendered in
    // normal flow beside the cells and showed the typed digits a second time.
    // The cells draw the value and the caret, so the input itself carries none.
    containerClassName="relative gap-2.5"
    className="absolute inset-0 size-full opacity-0"
  >
    <InputOTPGroup className="gap-2.5">
      {SLOTS.map((slot) => (
        <InputOTPSlot
          key={slot}
          index={slot}
          className="size-14 rounded-xl border-2 border-slate-300 bg-white text-2xl font-semibold text-slate-900 shadow-xs transition-colors first:rounded-xl last:rounded-xl data-[active=true]:border-slate-900 data-[active=true]:ring-4 data-[active=true]:ring-slate-900/10"
        />
      ))}
    </InputOTPGroup>
  </InputOTP>
)
