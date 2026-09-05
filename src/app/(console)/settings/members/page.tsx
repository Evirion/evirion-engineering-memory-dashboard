import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { MembersPanel } from "@/components/settings/members-panel"
import { MembershipOutcomeNotice } from "@/components/settings/membership-outcome"
import { hasCapability } from "@/lib/auth/capabilities"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { readMembersSettings } from "@/server/queries/settings"
import { requireSessionContext } from "@/server/queries/session-context"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const MembersSettingsPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const [context, view, csrfToken, requested] = await Promise.all([
    requireSessionContext(),
    readMembersSettings(),
    readSessionCsrfToken(),
    searchParams.then((params) => params["result"]),
  ])

  if (context.status === "unavailable") {
    return <p className="text-sm text-slate-600">{context.message}</p>
  }

  const idempotencyKeys = {
    invite: crypto.randomUUID(),
    offboarding: crypto.randomUUID(),
    ...(view.status === "ready"
      ? Object.fromEntries([
          ...view.members
            .filter((member) => member.role !== "owner")
            .map((member) => [`role-${member.id}`, crypto.randomUUID()] as const),
          ...view.invitations.flatMap((invitation) => [
            [`resend-${invitation.invitationId}`, crypto.randomUUID()] as const,
            [`revoke-${invitation.invitationId}`, crypto.randomUUID()] as const,
          ]),
        ])
      : {}),
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-slate-600">
          Live membership inventory, pending invitations, and offboarding status.
        </p>
      </div>

      <MembershipOutcomeNotice
        result={typeof requested === "string" ? requested : undefined}
      />

      {view.status === "unavailable" ? (
        <ConsoleUnavailable
          failure={view.failure}
          heading="Members are not available right now"
        />
      ) : (
        <MembersPanel
          members={view.members}
          invitations={view.invitations}
          offboarding={view.offboarding}
          canManage={hasCapability(context.context, "organization.members.manage")}
          canRequestOffboarding={hasCapability(
            context.context,
            "organization.offboarding.request",
          )}
          canReadEmail={hasCapability(context.context, "organization.members.manage")}
          csrfToken={csrfToken}
          idempotencyKeys={idempotencyKeys}
          reauthenticationFreshUntil={
            context.context.session?.reauthenticationFreshUntil
          }
        />
      )}
    </section>
  )
}

export default MembersSettingsPage
