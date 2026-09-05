import type { NextRequest, NextResponse } from "next/server"

import {
  beginMembershipCommand,
  finishMembershipCommand,
  guardMembershipFreshness,
  membershipPendingMutation,
  readExpectedVersion,
  readInvitationId,
  refuseMembershipCommand,
} from "@/server/actions/membership-command"
import { revokeOrganizationInvitation } from "@/server/adapters/settings"

export const dynamic = "force-dynamic"

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginMembershipCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields, sessionContext } = command
  const pending = membershipPendingMutation(fields, "/api/settings/invitations/revoke")
  const stale = await guardMembershipFreshness(sessionContext, pending)
  if (stale) return stale

  const invitationId = readInvitationId(fields.form)
  const expectedVersion = readExpectedVersion(fields.form)
  if (invitationId === undefined || expectedVersion === undefined) {
    return refuseMembershipCommand("REQUEST_INVALID")
  }

  return finishMembershipCommand(
    await revokeOrganizationInvitation(scope, {
      invitationId,
      expectedVersion,
      idempotencyKey: fields.idempotencyKey,
    }),
    pending,
    sessionContext,
  )
}
