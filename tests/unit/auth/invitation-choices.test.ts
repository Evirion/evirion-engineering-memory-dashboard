import { describe, expect, it } from "vitest"

import { parseInvitationChoices } from "@/server/queries/invitation-choices"

/**
 * The pre-auth invitation read is the one backend call that does not go
 * through `callConsoleApi`, so it needs its own proof that it reads the same
 * envelope. It previously read `invitations` off the bare body, which no
 * backend response has ever carried.
 */

const REQUEST_ID = "00000000-0000-4000-8000-0000000003aa"

const enveloped = (data: unknown): unknown => ({
  contractVersion: "1.0",
  requestId: REQUEST_ID,
  data,
})

const invitations = [
  { invitationId: "00000000-0000-4000-8000-000000000201", organizationLabel: "Acme" },
  { invitationId: "00000000-0000-4000-8000-000000000202", organizationLabel: "Globex" },
]

describe("the pre-auth invitation payload", () => {
  it("reads the choices out of the success envelope", () => {
    expect(parseInvitationChoices(enveloped({ invitations }))).toEqual(invitations)
  })

  it("accepts an empty invitation list as a real answer, not a failure", () => {
    expect(parseInvitationChoices(enveloped({ invitations: [] }))).toEqual([])
  })

  it("rejects a bare body that carries the invitations without an envelope", () => {
    expect(parseInvitationChoices({ invitations })).toBeUndefined()
  })

  it("rejects an unannounced contract version", () => {
    expect(
      parseInvitationChoices({
        contractVersion: "1.1",
        requestId: REQUEST_ID,
        data: { invitations },
      }),
    ).toBeUndefined()
  })

  it("rejects an envelope whose request identifier is not a UUID", () => {
    expect(
      parseInvitationChoices({
        contractVersion: "1.0",
        requestId: "not-a-uuid",
        data: { invitations },
      }),
    ).toBeUndefined()
  })

  it("fails closed on an entry missing its label rather than rendering a partial list", () => {
    expect(
      parseInvitationChoices(
        enveloped({
          invitations: [{ invitationId: "00000000-0000-4000-8000-000000000201" }],
        }),
      ),
    ).toBeUndefined()
  })

  it("fails closed when the envelope carries no invitation list at all", () => {
    expect(parseInvitationChoices(enveloped({}))).toBeUndefined()
    expect(parseInvitationChoices(enveloped(null))).toBeUndefined()
  })
})
