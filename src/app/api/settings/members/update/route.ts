import type { NextRequest, NextResponse } from "next/server"

import {
  beginMembershipCommand,
  finishMembershipCommand,
  guardMembershipFreshness,
  membershipPendingMutation,
  readExpectedVersion,
  readMembershipId,
  readMembershipRole,
  refuseMembershipCommand,
} from "@/server/actions/membership-command"
import { updateOrganizationMembership } from "@/server/adapters/settings"

export const dynamic = "force-dynamic"

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginMembershipCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields, sessionContext } = command
  const pending = membershipPendingMutation(fields, "/api/settings/members/update")
  const stale = await guardMembershipFreshness(sessionContext, pending)
  if (stale) return stale

  const membershipId = readMembershipId(fields.form)
  const expectedVersion = readExpectedVersion(fields.form)
  const role = readMembershipRole(fields.form)
  const action = String(fields.form.get("action") ?? "")
  if (
    membershipId === undefined ||
    expectedVersion === undefined ||
    action !== "change_role" ||
    role === undefined
  ) {
    return refuseMembershipCommand("REQUEST_INVALID")
  }

  return finishMembershipCommand(
    await updateOrganizationMembership(scope, {
      membershipId,
      action: "change_role",
      role,
      expectedVersion,
      idempotencyKey: fields.idempotencyKey,
    }),
    pending,
    sessionContext,
  )
}
