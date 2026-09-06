import { EmailOtpRequestForm } from "@/components/auth/email-otp-request-form"
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
        <p
          role="alert"
          className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          {outcome}
        </p>
      )}
      <EmailOtpRequestForm csrfToken={csrfToken} />
    </section>
  )
}

export default SignInPage
