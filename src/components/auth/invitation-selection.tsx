import type { InvitationChoice } from "@/server/queries/invitation-choices"
import { buttonVariants } from "@/components/ui/button"

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
      <p className="text-sm text-ink-secondary">
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
            className="border-input bg-card hover:border-line-strong has-checked:border-ring has-checked:bg-accent flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors"
          >
            <input
              type="radio"
              name="invitationId"
              value={invitation.invitationId}
              required
              className="accent-primary size-4"
            />
            <span>{invitation.organizationLabel}</span>
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        className={buttonVariants({ variant: "primary", className: "self-start" })}
      >
        Accept invitation
      </button>
    </form>
  </section>
)
