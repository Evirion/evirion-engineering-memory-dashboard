import type {
  InvitationReceipt,
  MembershipReceipt,
  OffboardingReceipt,
} from "@contracts/console"

import {
  CommandOutcomeNotice,
  readCommandResult,
} from "@/components/repositories/command-outcome"

/**
 * What happened to the membership command the customer just sent.
 *
 * None of the seven receipt codes is a published error code, so routing one
 * through the shared reader would tell the customer the outcome is unknown for
 * a command that committed. The unsupported sentinel is deliberately absent
 * from this map: it belongs to the shared reader, which reports it as an
 * unknown outcome rather than as anything that changed.
 *
 * Each notice states what changed and, where two things could be confused,
 * what did not. Requesting offboarding is not offboarding, and a resend starts
 * a new delivery rather than a second invitation.
 */

type InvitationCode = InvitationReceipt["responseCode"]
type MembershipCode = MembershipReceipt["responseCode"]
type OffboardingCode = OffboardingReceipt["responseCode"]

/**
 * Typed against the receipts rather than written as bare strings, so a contract
 * that renames or drops one of these fails the typecheck instead of silently
 * sending a committed command home as an unknown outcome.
 */
const INVITATION_CREATED: InvitationCode = "ORGANIZATION_INVITATION_CREATED"
const INVITATION_RESEND_REQUESTED: InvitationCode =
  "ORGANIZATION_INVITATION_RESEND_REQUESTED"
const INVITATION_REVOKED: InvitationCode = "ORGANIZATION_INVITATION_REVOKED"
const ROLE_CHANGED: MembershipCode = "ORGANIZATION_MEMBERSHIP_ROLE_CHANGED"
const MEMBERSHIP_DISABLED: MembershipCode = "ORGANIZATION_MEMBERSHIP_DISABLED"
const OWNERSHIP_TRANSFERRED: MembershipCode = "ORGANIZATION_OWNERSHIP_TRANSFERRED"
const OFFBOARDING_REQUESTED: OffboardingCode = "ORGANIZATION_OFFBOARDING_REQUESTED"

export const MEMBERSHIP_RESPONSE_CODES: readonly string[] = [
  INVITATION_CREATED,
  INVITATION_RESEND_REQUESTED,
  INVITATION_REVOKED,
  ROLE_CHANGED,
  MEMBERSHIP_DISABLED,
  OWNERSHIP_TRANSFERRED,
  OFFBOARDING_REQUESTED,
]

const COMMITTED: Readonly<Record<string, { headline: string; detail: string }>> = {
  [INVITATION_CREATED]: {
    headline: "The invitation is created.",
    detail:
      "It appears below as pending until the person accepts it. Creating it grants no access on its own.",
  },
  [INVITATION_RESEND_REQUESTED]: {
    headline: "A new invitation delivery is requested.",
    detail:
      "The previous delivery is retired and the pending invitation keeps its place below. No second invitation is created.",
  },
  [INVITATION_REVOKED]: {
    headline: "The invitation is revoked.",
    detail:
      "The pending generation can no longer be accepted. Anyone already a member is unaffected.",
  },
  [ROLE_CHANGED]: {
    headline: "The member's role is changed.",
    detail:
      "Capabilities follow the new role on the member's next request. Existing sessions are not signed out by this.",
  },
  [MEMBERSHIP_DISABLED]: {
    headline: "The membership is disabled.",
    detail: "The member keeps their account and loses access to this organization.",
  },
  [OWNERSHIP_TRANSFERRED]: {
    headline: "Ownership is transferred.",
    detail: "The organization has a new owner. Your own role changed with it.",
  },
  [OFFBOARDING_REQUESTED]: {
    headline: "Your offboarding request is with Evirion.",
    detail:
      "Nothing is deleted or disabled yet. Only Evirion can execute offboarding, and its status appears above.",
  },
}

export const MembershipOutcomeNotice = ({ result }: { result: string | undefined }) => {
  const committed = result === undefined ? undefined : COMMITTED[result]

  if (committed) {
    return (
      <output
        aria-live="polite"
        data-testid={`membership-outcome-${result}`}
        className="flex flex-col gap-1 rounded border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900"
      >
        <span>{committed.headline}</span>
        <span className="text-xs">{committed.detail}</span>
      </output>
    )
  }

  const outcome = readCommandResult(result)
  return outcome ? <CommandOutcomeNotice result={outcome} /> : null
}
