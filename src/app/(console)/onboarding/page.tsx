import Link from "next/link"

import {
  GithubConnection,
  isSyncInProgress,
  isSyncStalled,
  SyncPoll,
  SyncStalledNotice,
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
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Welcome</h1>
        <p className="text-sm text-ink-secondary">
          Your account is active. Nothing is read from your repositories until you
          connect GitHub and explicitly activate one.
        </p>
      </div>

      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-secondary">
        <li>Connect the GitHub App to your organization.</li>
        <li>Activate the first repository you want covered.</li>
        <li>Choose how much of its history to bring in, if any.</li>
      </ol>

      {view.status === "unavailable" ? (
        <p className="rounded-2xl border border-border bg-muted px-5 py-4 text-sm text-ink-secondary">
          {view.failure.message}
        </p>
      ) : (
        <>
          {isSyncInProgress(view.installation) ? <SyncPoll /> : null}
          {isSyncStalled(view.installation) ? <SyncStalledNotice /> : null}
          <GithubConnection
            installation={view.installation}
            csrfToken={csrfToken}
            connectKey={crypto.randomUUID()}
            syncKey={crypto.randomUUID()}
          />
          <Link
            href="/repositories"
            prefetch={false}
            className="text-sm text-foreground underline underline-offset-2"
          >
            Go to repositories
          </Link>
        </>
      )}
    </section>
  )
}

export default OnboardingPage
