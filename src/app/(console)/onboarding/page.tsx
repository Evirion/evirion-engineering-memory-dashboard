import { requireSessionContext } from "@/server/queries/session-context"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The onboarding entry after a first successful sign-in.
 *
 * Connecting GitHub, activating a repository and importing history belong to
 * EEM-9/03 and EEM-9/04. This page states the order and starts nothing, so no
 * source work, consent or paid execution can begin here.
 */
const OnboardingPage = async () => {
  const result = await requireSessionContext()

  if (result.status === "unavailable") {
    return <p className="text-sm text-slate-600">{result.message}</p>
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Welcome</h1>
        <p className="text-sm text-slate-600">
          Your account is active. Nothing is read from your repositories until you
          connect GitHub and explicitly activate one.
        </p>
      </div>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-slate-700">
        <li>Connect the GitHub App to your organization.</li>
        <li>Activate the first repository you want covered.</li>
        <li>Choose how much of its history to bring in, if any.</li>
      </ol>
      <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        These steps arrive in a later release. Connecting an account never starts
        extraction on its own.
      </p>
    </section>
  )
}

export default OnboardingPage
