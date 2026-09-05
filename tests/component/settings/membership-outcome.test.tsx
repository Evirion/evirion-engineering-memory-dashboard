import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { readCommandResult } from "@/components/repositories/command-outcome"
import {
  MEMBERSHIP_RESPONSE_CODES,
  MembershipOutcomeNotice,
} from "@/components/settings/membership-outcome"

import { repositoryRoot } from "../../support/source-tree"

/**
 * EEM-9/06 C06, the same trap EEM-9/04 fell into and EEM-9/05 pinned.
 *
 * `readCommandResult` knows the published error codes and the word `applied`.
 * None of the seven membership, invitation and offboarding receipt codes is a
 * published error code, so routing one through it would tell the customer the
 * outcome is unknown for a command that committed and changed state.
 *
 * The sentinel is the other half. Every one of these receipts admits
 * `UNSUPPORTED_SERVER_RESPONSE`, so a backend can send it and the validator
 * will accept it. Reporting every success as a generic `applied` would have
 * printed it as a change that happened.
 */

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe("the shared reader", () => {
  it.each(MEMBERSHIP_RESPONSE_CODES)("fails closed on %s", (code) => {
    expect(readCommandResult(code)).toEqual({
      kind: "unknown",
      code: "UNSUPPORTED_SERVER_RESPONSE",
    })
  })

  it("is left unmodified by this subtask", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL("src/components/repositories/command-outcome.tsx", repositoryRoot),
      ),
      "utf8",
    )

    for (const code of MEMBERSHIP_RESPONSE_CODES) {
      expect(source).not.toContain(code)
    }
  })
})

describe("the membership outcome notice", () => {
  it.each([
    ["ORGANIZATION_INVITATION_CREATED", "The invitation is created."],
    [
      "ORGANIZATION_INVITATION_RESEND_REQUESTED",
      "A new invitation delivery is requested.",
    ],
    ["ORGANIZATION_INVITATION_REVOKED", "The invitation is revoked."],
    // Written without the apostrophe the renderer escapes, so this asserts the
    // copy rather than the escaping.
    ["ORGANIZATION_MEMBERSHIP_ROLE_CHANGED", "role is changed."],
    ["ORGANIZATION_MEMBERSHIP_DISABLED", "The membership is disabled."],
    ["ORGANIZATION_OWNERSHIP_TRANSFERRED", "Ownership is transferred."],
    ["ORGANIZATION_OFFBOARDING_REQUESTED", "Your offboarding request is with Evirion."],
  ])("reports %s as the committed outcome it is", (code, headline) => {
    const html = markup(<MembershipOutcomeNotice result={code} />)

    expect(html).toContain(headline)
    expect(html).not.toContain("The outcome is not known yet")
  })

  it("says an invitation grants nothing until it is accepted", () => {
    expect(
      markup(<MembershipOutcomeNotice result="ORGANIZATION_INVITATION_CREATED" />),
    ).toContain("grants no access on its own")
  })

  it("says a resend is a new delivery rather than a second invitation", () => {
    expect(
      markup(
        <MembershipOutcomeNotice result="ORGANIZATION_INVITATION_RESEND_REQUESTED" />,
      ),
    ).toContain("No second invitation is created")
  })

  it("says requesting offboarding is not offboarding", () => {
    // Only Evirion executes it. A customer who reads "requested" as "done"
    // would believe their data is gone when nothing has moved.
    expect(
      markup(<MembershipOutcomeNotice result="ORGANIZATION_OFFBOARDING_REQUESTED" />),
    ).toContain("Nothing is deleted or disabled yet")
  })

  it("reports the unsupported sentinel as an unknown outcome, not a success", () => {
    // Every membership receipt admits this value, so the notice must never
    // hold a committed reading for it.
    const html = markup(
      <MembershipOutcomeNotice result="UNSUPPORTED_SERVER_RESPONSE" />,
    )

    expect(html).toContain("The outcome is not known yet")
  })

  it("delegates a published error code to the shared reader", () => {
    expect(markup(<MembershipOutcomeNotice result="VERSION_CONFLICT" />)).toContain(
      "This changed while you were working",
    )
  })

  it("fails closed on a code no contract publishes", () => {
    const html = markup(<MembershipOutcomeNotice result="MEMBERSHIP_TOTALLY_FINE" />)

    expect(html).toContain("The outcome is not known yet")
    expect(html).not.toContain("MEMBERSHIP_TOTALLY_FINE")
  })

  it("renders nothing when no command was sent", () => {
    expect(markup(<MembershipOutcomeNotice result={undefined} />)).toBe("")
  })
})
