"use client"

/**
 * Submits the emailed code to the BFF. The code goes in a form body, never in
 * a URL, and the browser stores nothing: verification happens server-side and
 * the resulting tokens stay in `__Host-` cookies the browser cannot read.
 *
 * The code is one wide input rather than six boxes on purpose. Six boxes look
 * the part but break the three things that matter here: pasting a code from the
 * mail client, the `one-time-code` autofill iOS and Safari offer above the
 * keyboard, and a screen reader announcing one field instead of six. The
 * spacing does the visual work instead.
 */
export const OtpVerifyForm = ({
  csrfToken,
  email = "",
}: {
  csrfToken: string
  /**
   * Read from the sealed pre-auth cookie. When it is known the address is shown
   * rather than asked for, and travels in a hidden field; the server still
   * checks it against the HMAC the proof is bound to. When it is missing — an
   * expired or cleared transaction — the field comes back and the reader types
   * it, which is how this worked before.
   */
  email?: string
}) => (
  <form action="/api/auth/verify-otp" method="post" className="flex flex-col gap-5">
    <input type="hidden" name="csrfToken" value={csrfToken} />

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
      <label htmlFor="code" className="sr-only">
        Six-digit code
      </label>
      <input
        id="code"
        name="code"
        type="text"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="------"
        aria-describedby="code-hint"
        className="otp-entry w-full rounded-lg border border-slate-300 bg-white py-5 text-3xl font-semibold text-slate-900 placeholder:text-slate-300 focus-visible:border-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <p id="code-hint" className="text-xs text-slate-500">
        Only the most recent code works. Asking for a new one cancels the previous code.
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
