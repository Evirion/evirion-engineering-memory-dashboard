import Link from "next/link"

import {
  GithubConnection,
  isSyncInProgress,
  SyncPoll,
} from "@/components/repositories/github-connection"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { readRepositoryList } from "@/server/queries/repositories"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The onboarding entry after a first successful sign-in.
 *
 * It carries the first step, connecting GitHub, and nothing else. Connecting
 * reads which repositories exist; it creates no entitlement, starts no source
 * work and authorizes no model call. Activation is the customer's separate,
 * explicit act on the repository itself.
 */
const OnboardingPage = async () => {
  const view = await readRepositoryList()
  const csrfToken = await readSessionCsrfToken()

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

      {view.status === "unavailable" ? (
        <p className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {view.failure.message}
        </p>
      ) : (
        <>
          {isSyncInProgress(view.installation) ? <SyncPoll /> : null}
          <GithubConnection
            installation={view.installation}
            csrfToken={csrfToken}
            connectKey={crypto.randomUUID()}
            syncKey={crypto.randomUUID()}
          />
          <Link
            href="/repositories"
            prefetch={false}
            className="text-sm text-slate-900 underline underline-offset-2"
          >
            Go to repositories
          </Link>
        </>
      )}
    </section>
  )
}

export default OnboardingPage
