import { OtpCells } from "@/components/auth/otp-cells"
import { describeTreatment } from "@/lib/errors/console-errors"
import {
  INVALID_CHALLENGE,
  PENDING_EXPIRED,
  PENDING_SESSION_MISMATCH,
  TOTP_REJECTED,
} from "@/lib/auth/reauthentication-result-codes"
import type { ReauthenticationGate } from "@/lib/auth/reauthentication-action-class"

const ceremonyMessage = (result: string | undefined): string | undefined => {
  if (result === undefined || result === "") return undefined
  if (result === INVALID_CHALLENGE) return undefined
  if (result === "REAUTHENTICATION_REQUIRED") return undefined
  if (result === TOTP_REJECTED) {
    return "That code did not match. Enter the current code and try again."
  }
  if (result === PENDING_EXPIRED) {
    return "Your paused action expired. Start again from the form below."
  }
  if (result === PENDING_SESSION_MISMATCH) {
    return "Your paused action belongs to a different session. Start again from the form below."
  }
  return describeTreatment(
    result === "UNSUPPORTED_SERVER_RESPONSE"
      ? "unknown-outcome"
      : result === "DEPENDENCY_UNAVAILABLE"
        ? "retry-bounded"
        : "non-retryable",
  )
}

/**
 * Step-up ceremony shown in place when freshness has lapsed or the backend
 * refused with `REAUTHENTICATION_REQUIRED`.
 */
export const ReauthenticationCeremony = ({
  csrfToken,
  result,
  revokesOtherSessions,
  gate,
  returnPath,
}: {
  csrfToken: string
  result?: string | undefined
  revokesOtherSessions: boolean
  gate: ReauthenticationGate
  returnPath: string
}) => {
  const feedback = ceremonyMessage(result)

  return (
    <section
      aria-labelledby="reauth-ceremony-heading"
      data-testid="reauth-ceremony"
      className="flex flex-col gap-4 rounded-2xl border border-line-strong bg-muted px-5 py-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="reauth-ceremony-heading"
          className="text-sm font-semibold text-foreground"
        >
          Confirm your identity to continue
        </h2>
        <p className="text-sm text-ink-secondary">
          Enter the current six-digit code from your authenticator app to continue what
          you were doing.
        </p>
        {revokesOtherSessions ? (
          <p
            data-testid="reauth-revokes-other-sessions"
            className="text-sm text-ink-secondary"
          >
            Completing this step closes your other signed-in sessions. You stay signed
            in here and can finish your work on this device.
          </p>
        ) : null}
      </div>

      {result === INVALID_CHALLENGE ? (
        <output
          aria-live="polite"
          data-testid="reauth-challenge-invalidated"
          className="rounded-xl border border-l-[3px] border-tone-attention-border bg-tone-attention-fill px-3 py-2 text-sm text-tone-attention-text"
        >
          That confirmation expired or is no longer valid. Start again below.
        </output>
      ) : null}

      {feedback !== undefined ? (
        <output
          aria-live="polite"
          data-testid="reauth-ceremony-feedback"
          className="text-sm text-ink-secondary"
        >
          {feedback}
        </output>
      ) : null}

      <form
        action="/api/session/reauthentication/complete"
        method="post"
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <div className="flex flex-col gap-1">
          <label htmlFor="reauth-totp" className="text-sm font-medium text-foreground">
            Authenticator code
          </label>
          <OtpCells id="reauth-totp" name="totp" />
        </div>
        <button
          type="submit"
          data-testid="reauth-complete"
          className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Confirm and continue
        </button>
      </form>

      <form action="/api/session/reauthentication/issue" method="post">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="gate" value={gate} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <button
          type="submit"
          data-testid="reauth-issue"
          className="self-start text-sm text-ink-secondary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Start a new confirmation
        </button>
      </form>
    </section>
  )
}

export const ReauthenticationUnavailable = () => (
  <output
    aria-live="polite"
    data-testid="reauth-unavailable"
    className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-ink-secondary"
  >
    Your paused action is no longer available. Continue from the form below.
  </output>
)

export { INVALID_CHALLENGE }
