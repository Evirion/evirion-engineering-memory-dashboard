import type { NextRequest, NextResponse } from "next/server"

import {
  beginMembershipCommand,
  finishMembershipCommand,
  guardMembershipFreshness,
  membershipPendingMutation,
  readInvitationEmail,
  readInvitationRole,
  refuseMembershipCommand,
} from "@/server/actions/membership-command"
import { createOrganizationInvitation } from "@/server/adapters/settings"

export const dynamic = "force-dynamic"

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginMembershipCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields, sessionContext } = command
  const pending = membershipPendingMutation(fields, "/api/settings/invitations/create")
  const stale = await guardMembershipFreshness(sessionContext, pending)
  if (stale) return stale

  const email = readInvitationEmail(fields.form)
  const role = readInvitationRole(fields.form)
  if (email === undefined || role === undefined) {
    return refuseMembershipCommand("REQUEST_INVALID")
  }

  return finishMembershipCommand(
    await createOrganizationInvitation(scope, {
      email,
      role,
      idempotencyKey: fields.idempotencyKey,
    }),
    pending,
    sessionContext,
  )
}
