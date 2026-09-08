import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { requireSessionContext } from "@/server/queries/session-context"
import { SubmitButton } from "@/components/ui/submit-button"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The principal's own application-session inventory.
 *
 * Rows carry bounded device and time labels only: no IP address, no
 * User-Agent payload and no token. Revoking denies application access
 * immediately; the provider sign-out is a reconciled follow-up, and revoking
 * one selected non-current session is application-only because the standard
 * provider API cannot revoke an arbitrary session by ID.
 */
const SessionsPage = async () => {
  const result = await requireSessionContext()
  const csrfToken = await readSessionCsrfToken()

  if (result.status === "unavailable") {
    return <p className="text-sm text-ink-secondary">{result.message}</p>
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Your sessions
        </h1>
        <p className="text-sm text-ink-secondary">
          At most three sessions stay active. Signing in a fourth time replaces the
          oldest one, and you are told when that happens.
        </p>
      </div>

      <form
        action="/api/auth/sessions/revoke"
        method="post"
        className="flex flex-wrap gap-3"
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <SubmitButton
          name="selection"
          value="others"

          className="rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Sign out other sessions
        </SubmitButton>
        <SubmitButton
          name="selection"
          value="all"

          className="rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Sign out everywhere
        </SubmitButton>
      </form>

      <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-ink-secondary">
        Ending one other session takes effect here immediately. That specific session
        cannot also be ended at the identity provider, so it is recorded as not
        applicable rather than retried.
      </p>
    </section>
  )
}

export default SessionsPage
