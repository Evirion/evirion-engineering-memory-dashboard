import { AlertCircleIcon } from "lucide-react"

import { TotpCodeForm } from "@/components/auth/totp-code-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AUTH_OUTCOME_PARAMETER, describeAuthOutcome } from "@/lib/auth/auth-outcome"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { SubmitButton } from "@/components/ui/submit-button"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The AAL2 step-up. Passing it in the browser proves nothing on its own: the
 * backend enforces `aal2` for every privileged mutation, and a stale token
 * that still claims `aal2` after a factor change is refused there.
 */
const MfaChallengePage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const csrfToken = await readSessionCsrfToken()
  const parameter = (await searchParams)[AUTH_OUTCOME_PARAMETER]
  const outcome = describeAuthOutcome(
    typeof parameter === "string" ? parameter : undefined,
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Enter your authenticator code
        </h2>
        <p className="text-sm text-ink-secondary">
          Open your authenticator app and enter the current six-digit code.
        </p>
      </div>

      {outcome === undefined ? null : (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{outcome.title}</AlertTitle>
          <AlertDescription>{outcome.description}</AlertDescription>
        </Alert>
      )}

      <TotpCodeForm
        action="/api/auth/mfa/challenge"
        csrfToken={csrfToken}
        label="Authenticator code"
        submitLabel="Verify"
      />

      {/*
        The way out of a lost or mis-scanned authenticator. Without it a reader
        whose app holds a factor the account no longer has can only press Verify
        again, which is exactly the dead end this page used to be.
      */}
      <form
        action="/api/auth/mfa/restart"
        method="post"
        className="border-t border-border pt-4"
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <SubmitButton className="text-sm text-ink-secondary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          Set up a new authenticator instead
        </SubmitButton>
      </form>
    </section>
  )
}

export default MfaChallengePage
