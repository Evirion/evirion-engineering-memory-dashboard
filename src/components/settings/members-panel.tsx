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
  memberStatusTone,
  offboardingStateLabel,
  offboardingStateTone,
} from "@/lib/settings/presentation"
import { buttonVariants } from "@/components/ui/button"
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/field"
import { panelVariants } from "@/components/ui/panel"
import { StatusChip } from "@/components/ui/status-chip"
import {
  Table,
  TableBody,
  TableCell,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SectionTitle } from "@/components/ui/text"
import { SubmitButton } from "@/components/ui/submit-button"

const button = buttonVariants({ variant: "outline", size: "sm" })
const card = panelVariants({ className: "flex flex-col gap-3" })

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
        <SectionTitle>Members</SectionTitle>
        <TableFrame>
          <Table aria-label="Members">
            <TableHead>
              <TableRow>
                {canReadEmail ? <TableHeader scope="col">Email</TableHeader> : null}
                <TableHeader scope="col">Role</TableHeader>
                <TableHeader scope="col">Status</TableHeader>
                {canManage ? <TableHeader scope="col">Actions</TableHeader> : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id} data-testid="member-row">
                  {canReadEmail ? (
                    <TableCell data-testid="member-email">
                      <span className="text-foreground font-mono text-sm">
                        {member.email}
                      </span>
                    </TableCell>
                  ) : null}
                  <TableCell>{memberRoleLabel(member.role)}</TableCell>
                  <TableCell>
                    <StatusChip tone={memberStatusTone(member.status)}>
                      {memberStatusLabel(member.status)}
                    </StatusChip>
                  </TableCell>
                  {canManage && roleControl(actorRole, member) === "editable" ? (
                    <TableCell>
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
                        <Select
                          id={`role-${member.id}`}
                          name="role"
                          defaultValue={member.role}
                          className="h-8 w-auto text-xs"
                        >
                          {assignableRoles(actorRole).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        <SubmitButton className={button}>Update role</SubmitButton>
                      </GatedForm>
                    </TableCell>
                  ) : canManage ? (
                    <TableCell className="text-muted-foreground text-xs">
                      {roleControl(actorRole, member) === "owner-fixed"
                        ? "Owner role is fixed here"
                        : "Only an owner can change this role"}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      </section>

      {canManage ? (
        <section aria-label="Pending invitations" className="flex flex-col gap-3">
          <SectionTitle>Pending invitations</SectionTitle>
          {invitations.length === 0 ? (
            <p className="border-line-default text-ink-secondary rounded-2xl border border-dashed px-5 py-6 text-sm">
              No pending invitations.
            </p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Invitations">
              {invitations.map((invitation) => (
                <li
                  key={invitation.invitationId}
                  data-testid="invitation-row"
                  className={panelVariants({
                    padding: "compact",
                    className:
                      "flex flex-wrap items-center justify-between gap-3 text-sm",
                  })}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground font-mono font-medium">
                      {invitation.email}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {memberRoleLabel(invitation.role)} ({invitation.state})
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
                      <SubmitButton className={button} aria-label="Resend invitation">
                        Resend
                      </SubmitButton>
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
                      <SubmitButton className={button} aria-label="Revoke invitation">
                        Revoke
                      </SubmitButton>
                    </GatedForm>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className={card}>
            <SectionTitle className="text-base">Invite a member</SectionTitle>
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invitation-email">Invitation email</Label>
                <Input
                  id="invitation-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invitation-role">Invitation role</Label>
                <Select id="invitation-role" name="role" defaultValue="viewer">
                  <option value="admin">Admin</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="viewer">Viewer</option>
                </Select>
              </div>
              <SubmitButton
                className={buttonVariants({
                  variant: "primary",
                  className: "self-start",
                })}
                data-testid="invite-member-button"
              >
                Invite member
              </SubmitButton>
            </GatedForm>
          </div>
        </section>
      ) : null}

      <section aria-label="Offboarding status" className="flex flex-col gap-2">
        <SectionTitle>Offboarding</SectionTitle>
        {offboarding === null ? (
          <p className="text-ink-secondary text-sm">
            No offboarding request is on record.
          </p>
        ) : (
          <div className="flex flex-col items-start gap-2">
            {/*
              The chip carries the tone and the glyph; the word "Status" stays
              in the sentence because it is the shipped copy and it is what
              tells a screen reader which question the value answers.
            */}
            <p className="text-ink-secondary flex flex-wrap items-center gap-2 text-sm">
              Status:{" "}
              <StatusChip tone={offboardingStateTone(offboarding.state)}>
                {offboardingStateLabel(offboarding.state)}
              </StatusChip>
            </p>
            {offboarding.reason ? (
              <p className="text-ink-secondary text-sm">Reason: {offboarding.reason}</p>
            ) : null}
          </div>
        )}

        {canRequestOffboarding && offboarding === null ? (
          <div className={card}>
            <SectionTitle className="text-base">Request offboarding</SectionTitle>
            <p className="text-sm text-ink-secondary">
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offboarding-reason">Reason (optional)</Label>
                <Textarea id="offboarding-reason" name="reason" rows={3} />
              </div>
              {/* The contract fixes this to true, so an unticked box is refused
                  rather than defaulted. Requesting offboarding is not
                  reversible from this surface. */}
              <label
                htmlFor="offboarding-confirmation"
                className="text-foreground flex items-center gap-2 text-sm"
              >
                <Checkbox
                  id="offboarding-confirmation"
                  name="confirmationAccepted"
                  value="true"
                  data-testid="offboarding-confirmation"
                />
                I confirm this request
              </label>
              <SubmitButton
                className={buttonVariants({
                  variant: "primary",
                  className: "self-start",
                })}
                data-testid="offboarding-request-button"
              >
                Request offboarding
              </SubmitButton>
            </GatedForm>
          </div>
        ) : null}
      </section>
    </div>
  )
}
