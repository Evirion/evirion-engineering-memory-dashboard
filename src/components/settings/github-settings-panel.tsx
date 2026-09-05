import type {
  GithubInstallation,
  GithubSettingsSummary,
  SessionContext,
} from "@contracts/console"

import {
  GithubConnection,
  isSyncInProgress,
  SyncPoll,
} from "@/components/repositories/github-connection"
import { hasCapability } from "@/lib/auth/capabilities"
import { githubInstallationStatusLabel } from "@/lib/settings/presentation"

const asInstallation = (summary: GithubSettingsSummary): GithubInstallation => {
  const installation =
    summary.installation === null ||
    summary.installation.status === "UNSUPPORTED_SERVER_RESPONSE"
      ? null
      : {
          accountLogin: summary.installation.accountLogin,
          connectedAt: summary.installation.connectedAt,
          id: summary.installation.id,
          status: summary.installation.status,
        }

  return {
    organizationId: summary.organizationId,
    installation,
    setupIntent: summary.setupIntent,
    latestSyncRun: summary.latestSyncRun,
    repositorySummary: summary.repositorySummary,
  }
}

export const GithubSettingsPanel = ({
  summary,
  context,
  csrfToken,
  connectKey,
  syncKey,
}: {
  summary: GithubSettingsSummary
  context: SessionContext
  csrfToken: string
  connectKey: string
  syncKey: string
}) => {
  const canManage = hasCapability(context, "organization.github.manage")
  const installation = asInstallation(summary)

  return (
    <section aria-label="GitHub settings" className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Accessible repositories
          </dt>
          <dd className="text-sm text-slate-900">
            {summary.repositorySummary.accessibleRepositories}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Inaccessible repositories
          </dt>
          <dd className="text-sm text-slate-900">
            {summary.repositorySummary.inaccessibleRepositories}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Active entitled repositories
          </dt>
          <dd className="text-sm text-slate-900">{summary.activeRepositories}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Last successful sync
          </dt>
          <dd className="text-sm text-slate-900">
            {summary.lastSuccessfulSyncAt ?? "Never"}
          </dd>
        </div>
      </dl>

      {summary.installation ? (
        <p className="text-sm text-slate-700">
          Installation {summary.installation.accountLogin} is{" "}
          {githubInstallationStatusLabel(summary.installation.status)}. Access is not
          entitlement.
        </p>
      ) : (
        <p className="text-sm text-slate-700">No GitHub installation is connected.</p>
      )}

      {canManage ? (
        <>
          {isSyncInProgress(installation) ? <SyncPoll /> : null}
          <GithubConnection
            installation={installation}
            csrfToken={csrfToken}
            connectKey={connectKey}
            syncKey={syncKey}
          />
        </>
      ) : (
        <p className="text-sm text-slate-600">
          GitHub connection controls require the GitHub management capability.
        </p>
      )}
    </section>
  )
}
