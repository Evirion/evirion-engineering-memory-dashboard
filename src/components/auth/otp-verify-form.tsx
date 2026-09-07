"use client"

import { useRef } from "react"

import { OtpCells } from "@/components/auth/otp-cells"

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
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="code" className="text-sm font-medium">
          Six-digit code
        </label>
        <OtpCells
          id="code"
          name="code"
          describedBy="code-hint"
          // Only when the address is already carried. With the field visible the
          // reader may still be filling it, and submitting on the sixth digit
          // would meet a validation error they did not ask for.
          {...(email ? { onComplete: () => form.current?.requestSubmit() } : {})}
        />
        <p id="code-hint" className="text-xs text-slate-500">
          Only the most recent code works. Asking for a new one cancels the previous
          code.
        </p>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Verify and continue
      </button>
    </form>
  )
}
