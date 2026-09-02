import type { GithubInstallation, GithubSyncRun } from "@contracts/console"

/**
 * GitHub installation status and synchronization progress.
 *
 * Two rules from GH-003 and J-009 shape everything here. An incomplete
 * traversal never implies that a repository lost access, so a running sync is
 * reported as in progress rather than as a smaller inventory. And a suspended
 * or removed installation blocks new source work immediately, which is a state
 * the customer must be able to see and act on.
 *
 * No installation identity is created here. The Console asks the backend for a
 * one-time setup intent and hands the customer to GitHub; the callback is the
 * backend control plane's, and no App key or installation token ever reaches
 * this process.
 */

export type GithubConnectionProps = {
  readonly installation: GithubInstallation | null
  readonly csrfToken: string
  readonly connectKey: string
  readonly syncKey: string
}

const submit =
  "rounded border border-slate-400 px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"

const statusLine = (installation: GithubInstallation): string => {
  if (installation.installation === null) return "Not connected"

  switch (installation.installation.status) {
    case "ACTIVE":
      return `Connected to ${installation.installation.accountLogin}`
    case "SUSPENDED":
      return `Suspended for ${installation.installation.accountLogin}`
    case "REMOVED":
      return `Removed from ${installation.installation.accountLogin}`
    default: {
      const exhaustive: never = installation.installation.status
      throw new Error(`unhandled installation status: ${String(exhaustive)}`)
    }
  }
}

const syncLine = (run: GithubSyncRun): string => {
  switch (run.status) {
    case "QUEUED":
      return "Synchronization is queued."
    case "RUNNING":
      // Deliberately not a repository count: a partial traversal must never
      // read as an inventory that shrank.
      return `Synchronization is running. ${run.progress.pagesApplied} pages read so far; the inventory below is the last complete one.`
    case "COMPLETED":
      return `Last synchronization completed. ${run.progress.repositoriesSeen} repositories seen, ${run.progress.repositoriesMarkedInaccessible} marked inaccessible.`
    case "FAILED":
      return "The last synchronization did not finish, so repository access is unchanged from the previous complete run."
    case "UNSUPPORTED":
      return "The synchronization state is not recognised. Refresh to check again."
    default: {
      const exhaustive: never = run.status
      throw new Error(`unhandled synchronization status: ${String(exhaustive)}`)
    }
  }
}

export const isSyncInProgress = (installation: GithubInstallation | null): boolean =>
  installation?.latestSyncRun?.status === "QUEUED" ||
  installation?.latestSyncRun?.status === "RUNNING"

export const GithubConnection = ({
  installation,
  csrfToken,
  connectKey,
  syncKey,
}: GithubConnectionProps) => {
  if (installation === null) {
    return (
      <p className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        GitHub connection status is not available for your account.
      </p>
    )
  }

  // Reconnecting is what a suspended or removed installation needs, so the
  // label follows whether an installation exists rather than whether it works.
  const everConnected = installation.installation !== null
  const connected = installation.installation?.status === "ACTIVE"
  const needsAttention = everConnected && !connected

  return (
    <section
      aria-label="GitHub connection"
      className="flex flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-slate-900">GitHub connection</h2>
      <p className="text-sm text-slate-900">{statusLine(installation)}</p>

      {needsAttention ? (
        <p className="text-sm text-amber-900">
          New source work is blocked while the installation is in this state.
          Reconnecting restores access; no entitlement or history is lost.
        </p>
      ) : null}

      {installation.latestSyncRun === null ? (
        <p className="text-sm text-slate-700">No synchronization has run yet.</p>
      ) : (
        <p className="text-sm text-slate-700">{syncLine(installation.latestSyncRun)}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <form action="/api/github/connect" method="post">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="idempotencyKey" value={connectKey} />
          <button type="submit" className={submit}>
            {everConnected ? "Reconnect GitHub" : "Connect GitHub"}
          </button>
        </form>

        {connected ? (
          <form action="/api/github/sync" method="post">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="idempotencyKey" value={syncKey} />
            <button type="submit" className={submit}>
              Synchronize repositories
            </button>
          </form>
        ) : null}
      </div>

      <p className="text-xs text-slate-600">
        Connecting reads which repositories exist. It activates nothing and starts no
        processing.
      </p>
    </section>
  )
}

/**
 * A bounded poll while a traversal is still running.
 *
 * It stops the moment the run reaches a terminal state, because the caller only
 * renders this while the status is queued or running.
 */
export const SyncPoll = () => <meta httpEquiv="refresh" content="5" />
