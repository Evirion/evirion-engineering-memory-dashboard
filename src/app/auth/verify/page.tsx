import { OtpVerifyForm } from "@/components/auth/otp-verify-form"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { readPreAuthCsrfToken, readSealedEmailAddress } from "@/server/actions/pre-auth"

export const dynamic = "force-dynamic"

const VerifyPage = async () => {
  const csrfToken = await readPreAuthCsrfToken()
  const email = await readSealedEmailAddress()

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Enter your code</h2>
        <p className="text-sm text-slate-600">
          The code is valid for {SESSION_POLICY.emailOtpLifetimeSeconds / 60} minutes.
          You can ask for a new one after {SESSION_POLICY.otpResendCooldownSeconds}{" "}
          seconds.
        </p>
      </div>
      <OtpVerifyForm csrfToken={csrfToken} email={email} />
    </section>
  )
}

export default VerifyPage
