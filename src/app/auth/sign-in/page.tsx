import { EmailOtpRequestForm } from "@/components/auth/email-otp-request-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AUTH_OUTCOME_PARAMETER, describeAuthOutcome } from "@/lib/auth/auth-outcome"
import { readPreAuthCsrfToken } from "@/server/actions/pre-auth"

export const dynamic = "force-dynamic"

/**
 * Sign-in requests a bounded email code. It discloses nothing about whether
 * the address is known: an unknown address and a known one produce the same
 * response, because a distinguishable one is an enumeration oracle.
 */
const SignInPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const csrfToken = await readPreAuthCsrfToken()
  const parameter = (await searchParams)[AUTH_OUTCOME_PARAMETER]
  const outcome = describeAuthOutcome(
    typeof parameter === "string" ? parameter : undefined,
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
        <p className="text-sm text-slate-600">
          Enter the email address your invitation was sent to. We will send a short
          code.
        </p>
      </div>
      {outcome === undefined ? null : (
        <Alert variant="destructive">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM9.25 5.75a.75.75 0 0 1 1.5 0v5a.75.75 0 0 1-1.5 0v-5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          <AlertDescription>{outcome}</AlertDescription>
        </Alert>
      )}
      <EmailOtpRequestForm csrfToken={csrfToken} />
    </section>
  )
}

export default SignInPage
