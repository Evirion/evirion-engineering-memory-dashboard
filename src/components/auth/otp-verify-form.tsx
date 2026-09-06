"use client"

/**
 * Submits the emailed code to the BFF. The code goes in a form body, never in
 * a URL, and the browser stores nothing: verification happens server-side and
 * the resulting tokens stay in `__Host-` cookies the browser cannot read.
 */
export const OtpVerifyForm = ({
  csrfToken,
  email = "",
}: {
  csrfToken: string
  /**
   * Filled from the sealed pre-auth cookie so the address is typed once. It
   * stays editable: the server still checks it against the HMAC the proof is
   * bound to, so correcting a typo here fails closed rather than signing
   * someone else in.
   */
  email?: string
}) => (
  <form action="/api/auth/verify-otp" method="post" className="flex flex-col gap-4">
    <input type="hidden" name="csrfToken" value={csrfToken} />
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
        defaultValue={email}
        className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      />
    </div>
    <div className="flex flex-col gap-2">
      <label htmlFor="code" className="text-sm font-medium">
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
        aria-describedby="code-hint"
        className="rounded border border-slate-300 px-3 py-2 font-mono text-sm tracking-widest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <p id="code-hint" className="text-xs text-slate-500">
        Only the most recent code works. Asking for a new one cancels the previous code.
      </p>
    </div>
    <button
      type="submit"
      className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      Verify and continue
    </button>
  </form>
)
