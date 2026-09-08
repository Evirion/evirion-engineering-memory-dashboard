import type {
  GithubInstallation,
  GithubSettingsSummary,
  SessionContext,
} from "@contracts/console"

import {
  GithubConnection,
  InstallationPendingPoll,
  isInstallationPending,
  isSyncInProgress,
  isSyncStalled,
  SyncPoll,
  SyncStalledNotice,
} from "@/components/repositories/github-connection"
import { hasCapability } from "@/lib/auth/capabilities"
import {
  githubInstallationStatusLabel,
  githubInstallationStatusTone,
} from "@/lib/settings/presentation"
import { Metric, MetricGrid } from "@/components/ui/metric"
import { noticeClasses } from "@/components/ui/panel"
import { StatusChip } from "@/components/ui/status-chip"

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
  const pendingInstallation = isInstallationPending(installation)

  return (
    <section aria-label="GitHub settings" className="flex flex-col gap-4">
      <MetricGrid className="lg:grid-cols-4">
        <Metric
          label="Accessible repositories"
          value={summary.repositorySummary.accessibleRepositories}
        />
        <Metric
          label="Inaccessible repositories"
          value={summary.repositorySummary.inaccessibleRepositories}
        />
        <Metric
          label="Active entitled repositories"
          value={summary.activeRepositories}
        />
        <Metric
          label="Last successful sync"
          value={
            <span className="text-sm">{summary.lastSuccessfulSyncAt ?? "Never"}</span>
          }
        />
      </MetricGrid>

      {summary.installation ? (
        <p className="text-ink-secondary flex flex-wrap items-center gap-2 text-sm">
          Installation
          <span className="text-foreground font-mono">
            {summary.installation.accountLogin}
          </span>
          is
          <StatusChip tone={githubInstallationStatusTone(summary.installation.status)}>
            {githubInstallationStatusLabel(summary.installation.status)}
          </StatusChip>
          {/* Access is not entitlement, and the page says so rather than
              letting a healthy installation imply anything is activated. */}
          <span>Access is not entitlement.</span>
        </p>
      ) : pendingInstallation ? (
        <p className={noticeClasses("progress", "text-sm leading-6")}>
          GitHub confirmed the installation request. Waiting for provider proof before
          the connection becomes active.
        </p>
      ) : (
        <p className="text-ink-secondary text-sm">
          No GitHub installation is connected.
        </p>
      )}

      {canManage ? (
        <>
          {pendingInstallation ? <InstallationPendingPoll /> : null}
          {isSyncInProgress(installation) ? <SyncPoll /> : null}
          {isSyncStalled(installation) ? <SyncStalledNotice /> : null}
          <GithubConnection
            installation={installation}
            csrfToken={csrfToken}
            connectKey={connectKey}
            syncKey={syncKey}
          />
        </>
      ) : (
        // Hiding a control is a convenience, never an authorization. Saying
        // which capability is missing is what stops it reading as a defect.
        <p className={noticeClasses("holding", "text-sm leading-6")}>
          GitHub connection controls require the GitHub management capability.
        </p>
      )}
    </section>
  )
}
