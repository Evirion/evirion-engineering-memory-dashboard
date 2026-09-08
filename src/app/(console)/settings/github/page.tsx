import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  CommandOutcomeNotice,
  readCommandResult,
} from "@/components/repositories/command-outcome"
import { GithubSettingsPanel } from "@/components/settings/github-settings-panel"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { readGithubSettings } from "@/server/queries/settings"
import { requireSessionContext } from "@/server/queries/session-context"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The installation return lands here, so its outcome has to be readable.
 *
 * `pending` is not a refusal and the panel already says so from the committed
 * projection beside it, which is the authority. Everything else goes through
 * the shared reader, so an unpublished code fails closed instead of printing.
 */
const readReturnOutcome = (raw: string | string[] | undefined) => {
  if (typeof raw !== "string" || raw === "pending") return undefined
  return readCommandResult(raw)
}

const GithubSettingsPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const [context, view, csrfToken, parameters] = await Promise.all([
    requireSessionContext(),
    readGithubSettings(),
    readSessionCsrfToken(),
    searchParams,
  ])
  const outcome = readReturnOutcome(parameters["result"])

  if (context.status === "unavailable") {
    return <p className="text-sm text-ink-secondary">{context.message}</p>
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">GitHub</h1>
        <p className="text-sm text-ink-secondary">
          Installation reach and entitled repositories are counted separately. Access is
          not entitlement.
        </p>
      </div>

      {outcome ? <CommandOutcomeNotice result={outcome} /> : null}

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
