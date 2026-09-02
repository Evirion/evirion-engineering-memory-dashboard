import type { InvitationChoice } from "@/server/queries/invitation-choices"

/**
 * Several eligible invitations require an explicit choice. There is no
 * order-based auto-selection: the first row is not preselected, and the
 * identifier submitted is opaque.
 */
export const InvitationSelection = ({
  csrfToken,
  invitations,
}: {
  csrfToken: string
  invitations: readonly InvitationChoice[]
}) => (
  <section className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight">Choose an organization</h2>
      <p className="text-sm text-slate-600">
        You have more than one invitation. Select the one to accept.
      </p>
    </div>
    <form
      action="/api/auth/select-invitation"
      method="post"
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Available invitations</legend>
        {invitations.map((invitation) => (
          <label
            key={invitation.invitationId}
            className="flex items-center gap-3 rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <input
              type="radio"
              name="invitationId"
              value={invitation.invitationId}
              required
              className="size-4"
            />
            <span>{invitation.organizationLabel}</span>
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Accept invitation
      </button>
    </form>
  </section>
)
