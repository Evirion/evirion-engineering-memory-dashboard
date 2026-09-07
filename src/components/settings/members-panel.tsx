import type {
  Member,
  OrganizationInvitations,
  OrganizationOffboarding,
} from "@contracts/console"

import { GatedForm } from "@/components/auth/gated-form"
import { ReauthenticationPreconditionNotice } from "@/components/auth/reauthentication-notice"
import {
  memberRoleLabel,
  memberStatusLabel,
  offboardingStateLabel,
} from "@/lib/settings/presentation"

const field = "rounded border border-slate-300 px-2 py-1 text-sm"
const button =
  "rounded border border-slate-400 px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
const card = "flex flex-col gap-3 rounded border border-slate-200 bg-white px-4 py-3"

/**
 * Whether this reader may change this member's role, on the backend's terms.
 *
 * `api.update_organization_membership` lets an owner re-role anyone but an
 * owner, and lets an admin re-role only a reviewer or a viewer, and only into
 * one of those. The panel offered the control to every non-owner row, so an
 * admin was shown a picker for their own row and for other admins — actions the
 * backend answers `CAPABILITY_REQUIRED`. Nothing was ever at risk; the reader
 * was simply invited to do something impossible.
 */
const ASSIGNABLE_BY_ADMIN = ["reviewer", "viewer"] as const

export const roleControl = (
  actorRole: Member["role"],
  member: Member,
): "editable" | "owner-fixed" | "owner-only" => {
  if (member.role === "owner") return "owner-fixed"
  if (actorRole === "owner") return "editable"
  return (ASSIGNABLE_BY_ADMIN as readonly string[]).includes(member.role)
    ? "editable"
    : "owner-only"
}

export const assignableRoles = (
  actorRole: Member["role"],
): readonly { readonly value: string; readonly label: string }[] =>
  actorRole === "owner"
    ? [
        { value: "admin", label: "Admin" },
        { value: "reviewer", label: "Reviewer" },
        { value: "viewer", label: "Viewer" },
      ]
    : [
        { value: "reviewer", label: "Reviewer" },
        { value: "viewer", label: "Viewer" },
      ]

const Hidden = ({
  csrfToken,
  idempotencyKey,
}: {
  csrfToken: string
  idempotencyKey: string
}) => (
  <>
    <input type="hidden" name="csrfToken" value={csrfToken} aria-label="CSRF token" />
    <input
      type="hidden"
      name="idempotencyKey"
      value={idempotencyKey}
      aria-label="Idempotency key"
    />
  </>
)

export const MembersPanel = ({
  actorRole,
  members,
  invitations,
  offboarding,
  canManage,
  canRequestOffboarding,
  canReadEmail,
  csrfToken,
  idempotencyKeys,
  reauthenticationFreshUntil,
}: {
  /** The reader's own role, which decides what the backend will accept. */
  actorRole: Member["role"]
  members: readonly Member[]
  invitations: OrganizationInvitations
  offboarding: OrganizationOffboarding | null
  canManage: boolean
  canRequestOffboarding: boolean
  canReadEmail: boolean
  csrfToken: string
  idempotencyKeys: Readonly<Record<string, string>>
  reauthenticationFreshUntil?: string | null | undefined
}) => {
  const settingsPath = "/settings/members"

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Organization members" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Members</h2>
        <table className="min-w-full text-left text-sm" aria-label="Members">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              {canReadEmail ? (
                <th scope="col" className="px-2 py-1">
                  Email
                </th>
              ) : null}
              <th scope="col" className="px-2 py-1">
                Role
              </th>
              <th scope="col" className="px-2 py-1">
                Status
              </th>
              {canManage ? (
                <th scope="col" className="px-2 py-1">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                data-testid="member-row"
                className="border-t border-slate-200"
              >
                {canReadEmail ? (
                  <td className="px-2 py-2" data-testid="member-email">
                    {member.email}
                  </td>
                ) : null}
                <td className="px-2 py-2">{memberRoleLabel(member.role)}</td>
                <td className="px-2 py-2">{memberStatusLabel(member.status)}</td>
                {canManage && roleControl(actorRole, member) === "editable" ? (
                  <td className="px-2 py-2">
                    <GatedForm
                      action="/api/settings/members/update"
                      freshUntil={reauthenticationFreshUntil}
                      gate="membership_change"
                      returnPath={settingsPath}
                      mutationPath="/api/settings/members/update"
                      className="flex items-center gap-2"
                    >
                      <Hidden
                        csrfToken={csrfToken}
                        idempotencyKey={idempotencyKeys[`role-${member.id}`] ?? ""}
                      />
                      <input type="hidden" name="membershipId" value={member.id} />
                      <input
                        type="hidden"
                        name="expectedVersion"
                        value={member.version}
                      />
                      <input type="hidden" name="action" value="change_role" />
                      <label className="sr-only" htmlFor={`role-${member.id}`}>
                        Role for {member.email}
                      </label>
                      <select
                        id={`role-${member.id}`}
                        name="role"
                        defaultValue={member.role}
                        className={field}
                      >
                        {assignableRoles(actorRole).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={button}>
                        Update role
                      </button>
                    </GatedForm>
                  </td>
                ) : canManage ? (
                  <td className="px-2 py-2 text-slate-500">
                    {roleControl(actorRole, member) === "owner-fixed"
                      ? "Owner role is fixed here"
                      : "Only an owner can change this role"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {canManage ? (
        <section aria-label="Pending invitations" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Pending invitations</h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-slate-600">No pending invitations.</p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Invitations">
              {invitations.map((invitation) => (
                <li
                  key={invitation.invitationId}
                  data-testid="invitation-row"
                  className="flex flex-col gap-2 rounded border border-slate-200 px-3 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-900">
                      {invitation.email}
                    </span>
                    <span className="text-slate-600">
                      {" "}
                      — {memberRoleLabel(invitation.role)} ({invitation.state})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <GatedForm
                      action="/api/settings/invitations/resend"
                      freshUntil={reauthenticationFreshUntil}
                      gate="membership_change"
                      returnPath={settingsPath}
                      mutationPath="/api/settings/invitations/resend"
                      ariaLabel={`Resend invitation to ${invitation.email}`}
                    >
                      <Hidden
                        csrfToken={csrfToken}
                        idempotencyKey={
                          idempotencyKeys[`resend-${invitation.invitationId}`] ?? ""
                        }
                      />
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invitation.invitationId}
                        aria-label="Invitation identifier"
                      />
                      <input
                        type="hidden"
                        name="expectedVersion"
                        value={invitation.version}
                        aria-label="Invitation version"
                      />
                      <button
                        type="submit"
                        className={button}
                        aria-label="Resend invitation"
                      >
                        Resend
                      </button>
                    </GatedForm>
                    <GatedForm
                      action="/api/settings/invitations/revoke"
                      freshUntil={reauthenticationFreshUntil}
                      gate="membership_change"
                      returnPath={settingsPath}
                      mutationPath="/api/settings/invitations/revoke"
                      ariaLabel={`Revoke invitation for ${invitation.email}`}
                    >
                      <Hidden
                        csrfToken={csrfToken}
                        idempotencyKey={
                          idempotencyKeys[`revoke-${invitation.invitationId}`] ?? ""
                        }
                      />
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invitation.invitationId}
                        aria-label="Invitation identifier"
                      />
                      <input
                        type="hidden"
                        name="expectedVersion"
                        value={invitation.version}
                        aria-label="Invitation version"
                      />
                      <button
                        type="submit"
                        className={button}
                        aria-label="Revoke invitation"
                      >
                        Revoke
                      </button>
                    </GatedForm>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className={card}>
            <h3 className="text-sm font-semibold text-slate-900">Invite a member</h3>
            <ReauthenticationPreconditionNotice />
            <GatedForm
              action="/api/settings/invitations/create"
              freshUntil={reauthenticationFreshUntil}
              gate="membership_change"
              returnPath={settingsPath}
              mutationPath="/api/settings/invitations/create"
              className="flex flex-col gap-3"
              dataTestId="invite-member-form"
            >
              <Hidden
                csrfToken={csrfToken}
                idempotencyKey={idempotencyKeys.invite ?? ""}
              />
              <label className="flex flex-col gap-1 text-sm" htmlFor="invitation-email">
                <span>Invitation email</span>
              </label>
              <input
                id="invitation-email"
                type="email"
                name="email"
                required
                className={field}
                autoComplete="off"
              />
              <label className="flex flex-col gap-1 text-sm" htmlFor="invitation-role">
                <span>Invitation role</span>
              </label>
              <select
                id="invitation-role"
                name="role"
                defaultValue="viewer"
                className={field}
              >
                <option value="admin">Admin</option>
                <option value="reviewer">Reviewer</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                className={button}
                data-testid="invite-member-button"
              >
                Invite member
              </button>
            </GatedForm>
          </div>
        </section>
      ) : null}

      <section aria-label="Offboarding status" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Offboarding</h2>
        {offboarding === null ? (
          <p className="text-sm text-slate-600">No offboarding request is on record.</p>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              Status: {offboardingStateLabel(offboarding.state)}
            </p>
            {offboarding.reason ? (
              <p className="text-sm text-slate-600">Reason: {offboarding.reason}</p>
            ) : null}
          </>
        )}

        {canRequestOffboarding && offboarding === null ? (
          <div className={card}>
            <h3 className="text-sm font-semibold text-slate-900">
              Request offboarding
            </h3>
            <p className="text-sm text-slate-600">
              Only Evirion can execute offboarding. This records a customer request.
            </p>
            <ReauthenticationPreconditionNotice />
            <GatedForm
              action="/api/settings/offboarding/request"
              freshUntil={reauthenticationFreshUntil}
              gate="membership_change"
              returnPath={settingsPath}
              mutationPath="/api/settings/offboarding/request"
              className="flex flex-col gap-3"
              dataTestId="offboarding-request-form"
            >
              <Hidden
                csrfToken={csrfToken}
                idempotencyKey={idempotencyKeys.offboarding ?? ""}
              />
              <label className="flex flex-col gap-1 text-sm">
                <span>Reason (optional)</span>
                <textarea name="reason" rows={3} className={field} />
              </label>
              {/* The contract fixes this to true, so an unticked box is refused
                  rather than defaulted. Requesting offboarding is not
                  reversible from this surface. */}
              <label className="flex items-center gap-2 text-sm text-slate-900">
                <input
                  type="checkbox"
                  name="confirmationAccepted"
                  value="true"
                  data-testid="offboarding-confirmation"
                />
                I confirm this request
              </label>
              <button
                type="submit"
                className={button}
                data-testid="offboarding-request-button"
              >
                Request offboarding
              </button>
            </GatedForm>
          </div>
        ) : null}
      </section>
    </div>
  )
}
