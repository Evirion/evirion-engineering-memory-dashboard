import Image from "next/image"

/**
 * Shows a new TOTP seed once, and takes the code that confirms it.
 *
 * The QR is the SVG the provider returns, and the secret is printed beside it
 * because a reader on the same device as their authenticator cannot photograph
 * their own screen. Neither is a secret the browser keeps: this response is
 * `no-store`, nothing is written to storage, and reloading the page issues a
 * new seed rather than showing this one again.
 *
 * The panel is a server component. It holds no state, so making it interactive
 * would buy nothing and would put the seed in a client bundle's props.
 */
export const TotpEnrolmentPanel = ({
  csrfToken,
  qrCode,
  secret,
}: {
  csrfToken: string
  /** A data-URI SVG from the provider, rendered as an image, never as markup. */
  qrCode: string
  secret: string
}) => (
  <section className="flex flex-col gap-5">
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight">
        Set up your authenticator
      </h2>
      <p className="text-sm text-slate-600">
        Your account is protected by a code from an app on your phone. Set it up once
        here, then enter a code each time you sign in.
      </p>
    </div>

    <ol className="flex flex-col gap-4 text-sm text-slate-700">
      <li className="flex flex-col gap-3">
        <span>
          <span className="font-medium">1.</span> Open an authenticator app — Google
          Authenticator, 1Password, Bitwarden or any other — and scan this code.
        </span>
        <Image
          src={qrCode}
          alt="QR code for your authenticator app"
          width={200}
          height={200}
          // The provider hands back an inline SVG data URI, so there is no
          // remote asset to fetch, resize or cache. Sending it through the
          // optimizer would also mean sending a seed to it.
          unoptimized
          className="self-start rounded-lg border border-slate-200 bg-white p-3"
        />
      </li>
      <li className="flex flex-col gap-2">
        <span>
          <span className="font-medium">2.</span> Cannot scan? Type this key into the
          app instead.
        </span>
        <code className="self-start break-all rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm tracking-wide text-slate-900">
          {secret}
        </code>
      </li>
    </ol>

    <form
      action="/api/auth/mfa/challenge"
      method="post"
      className="flex flex-col gap-4 border-t border-slate-200 pt-5"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <div className="flex flex-col gap-2">
        <label htmlFor="totp" className="text-sm font-medium">
          3. Enter the six-digit code the app shows
        </label>
        <input
          id="totp"
          name="totp"
          type="text"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="------"
          className="otp-entry w-full rounded-lg border border-slate-300 bg-white py-5 text-3xl font-semibold text-slate-900 placeholder:text-slate-300 focus-visible:border-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Confirm and continue
      </button>
    </form>
  </section>
)
