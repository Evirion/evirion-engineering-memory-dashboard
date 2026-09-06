import Link from "next/link"

import { OtpVerifyForm } from "@/components/auth/otp-verify-form"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { readPreAuthCsrfToken, readSealedEmailAddress } from "@/server/actions/pre-auth"

export const dynamic = "force-dynamic"

const VerifyPage = async () => {
  const csrfToken = await readPreAuthCsrfToken()
  const email = await readSealedEmailAddress()

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Check your email</h2>
        <p className="text-sm text-slate-600">
          {email ? (
            <>
              We sent a six-digit code to{" "}
              <span className="font-medium text-slate-900">{email}</span>.
            </>
          ) : (
            <>Enter the address the code was sent to, and the code.</>
          )}
        </p>
        <p className="text-sm text-slate-600">
          It works once and is valid for {SESSION_POLICY.emailOtpLifetimeSeconds / 60}{" "}
          minutes. If it does not go through, ask for a new one after{" "}
          {SESSION_POLICY.otpResendCooldownSeconds} seconds.
        </p>
      </div>

      <OtpVerifyForm csrfToken={csrfToken} email={email} />

      {/*
        Changing the address restarts the transaction rather than editing it in
        place: the proof is bound to one identity, so a new address needs a new
        proof and a new code.
      */}
      <Link
        href="/auth/sign-in"
        className="text-sm text-slate-600 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Use a different email address
      </Link>
    </section>
  )
}

export default VerifyPage
