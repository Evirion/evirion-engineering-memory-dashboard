import { InvitationSelection } from "@/components/auth/invitation-selection"
import { readInvitationChoices } from "@/server/queries/invitation-choices"

export const dynamic = "force-dynamic"

/**
 * Invitation acceptance after email verification.
 *
 * Zero, one and many are three different screens. Nothing about an
 * organization is disclosed before the session exists, and there is no
 * order-based auto-selection: when several invitations are eligible the
 * customer chooses explicitly from opaque identifiers.
 */
const InvitePage = async () => {
  const choices = await readInvitationChoices()

  switch (choices.status) {
    case "unauthenticated":
      return (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Sign in first</h2>
          <p className="text-sm text-slate-600">
            Verify your email address before accepting an invitation.
          </p>
        </section>
      )
    case "none":
      return (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            No invitation available
          </h2>
          <p className="text-sm text-slate-600">
            There is no invitation for this address. Ask your organization owner to send
            one.
          </p>
        </section>
      )
    case "single":
      return (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Invitation ready</h2>
          <p className="text-sm text-slate-600">
            Your invitation to {choices.only.organizationLabel} is being applied.
          </p>
        </section>
      )
    case "multiple":
      return (
        <InvitationSelection
          csrfToken={choices.csrfToken}
          invitations={choices.invitations}
        />
      )
    case "unavailable":
      return (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Not available right now
          </h2>
          <p className="text-sm text-slate-600">{choices.message}</p>
        </section>
      )
    default: {
      const exhaustive: never = choices
      throw new Error(`unhandled invitation state: ${JSON.stringify(exhaustive)}`)
    }
  }
}

export default InvitePage
