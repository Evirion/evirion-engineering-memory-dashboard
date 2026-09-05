import type { NextRequest, NextResponse } from "next/server"

import {
  beginMembershipCommand,
  finishMembershipCommand,
  guardMembershipFreshness,
  membershipPendingMutation,
  readOffboardingReason,
  refuseMembershipCommand,
} from "@/server/actions/membership-command"
import { requestOrganizationOffboarding } from "@/server/adapters/settings"

export const dynamic = "force-dynamic"

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginMembershipCommand(request)
  if (command.status === "rejected") return command.response

  const { scope, fields, sessionContext } = command
  const pending = membershipPendingMutation(fields, "/api/settings/offboarding/request")
  const stale = await guardMembershipFreshness(sessionContext, pending)
  if (stale) return stale

  const confirmationAccepted = fields.form.get("confirmationAccepted") === "true"
  if (!confirmationAccepted) {
    return refuseMembershipCommand("REQUEST_INVALID")
  }

  const reason = readOffboardingReason(fields.form)

  return finishMembershipCommand(
    await requestOrganizationOffboarding(scope, {
      confirmationAccepted: true,
      ...(reason === undefined ? {} : { reason }),
      idempotencyKey: fields.idempotencyKey,
    }),
    pending,
    sessionContext,
  )
}
