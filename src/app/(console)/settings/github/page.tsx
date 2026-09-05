import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { GithubSettingsPanel } from "@/components/settings/github-settings-panel"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { readGithubSettings } from "@/server/queries/settings"
import { requireSessionContext } from "@/server/queries/session-context"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const GithubSettingsPage = async () => {
  const [context, view, csrfToken] = await Promise.all([
    requireSessionContext(),
    readGithubSettings(),
    readSessionCsrfToken(),
  ])

  if (context.status === "unavailable") {
    return <p className="text-sm text-slate-600">{context.message}</p>
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">GitHub</h1>
        <p className="text-sm text-slate-600">
          Installation reach and entitled repositories are counted separately. Access is
          not entitlement.
        </p>
      </div>

      {view.status === "unavailable" ? (
        <ConsoleUnavailable
          failure={view.failure}
          heading="GitHub settings are not available right now"
        />
      ) : (
        <GithubSettingsPanel
          summary={view.summary}
          context={context.context}
          csrfToken={csrfToken}
          connectKey={crypto.randomUUID()}
          syncKey={crypto.randomUUID()}
        />
      )}
    </section>
  )
}

export default GithubSettingsPage
