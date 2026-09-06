import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { OPAQUE_INVITATION_ID, preAuthCookieNames } from "@/lib/auth/pre-auth-cookies"

import { repositoryRoot } from "../../support/source-tree"

/**
 * An invited reader must reach the sign-in path built for them.
 *
 * The backend has two: one for a member, which requires a membership in
 * `active`, and one keyed by invitation. An invited reader holds `invited`
 * until they accept, and accepting needs a session, so the member path can
 * never let them in. The invitation path is selected by naming the invitation
 * in the bootstrap.
 *
 * Both ends were already built. `verify-otp` forwards `invitationId` to the
 * backend and `/auth/invite` lists choices — but nothing ever put an identifier
 * into the form, so the first real design partner was refused with a session
 * that could not be started. These assertions hold each link of the chain.
 */

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8")

const SIGN_IN_PAGE = "src/app/auth/sign-in/page.tsx"
const REQUEST_FORM = "src/components/auth/email-otp-request-form.tsx"
const REQUEST_OTP = "src/app/api/auth/request-otp/route.ts"
const VERIFY_PAGE = "src/app/auth/verify/page.tsx"
const VERIFY_FORM = "src/components/auth/otp-verify-form.tsx"
const VERIFY_OTP = "src/app/api/auth/verify-otp/route.ts"

describe("the invitation identifier survives the whole sign-in", () => {
  it("is read from the link the reader followed", () => {
    const page = source(SIGN_IN_PAGE)

    expect(page).toContain('INVITATION_PARAMETER = "invitation"')
    expect(page).toContain("OPAQUE_INVITATION_ID")
    expect(page).toMatch(/invitationId=\{invitationId\}/)
  })

  it("leaves the sign-in form as a field the request can read", () => {
    expect(source(REQUEST_FORM)).toContain('name="invitationId"')
  })

  it("survives the redirect in a cookie rather than the redirect target", () => {
    const route = source(REQUEST_OTP)

    expect(route).toContain("PRE_AUTH_INVITATION_COOKIE")
    // The fixed redirect target is the property being protected: a caller
    // supplied value in it would make the destination partly theirs.
    expect(route).toContain('canonicalRedirect("/auth/verify")')
    expect(route).not.toMatch(/canonicalRedirect\(`/)
  })

  it("is read back on the verify page and carried by its form", () => {
    expect(source(VERIFY_PAGE)).toContain("readCarriedInvitationId")
    expect(source(VERIFY_FORM)).toContain('name="invitationId"')
  })

  it("reaches the bootstrap the backend routes on", () => {
    const route = source(VERIFY_OTP)

    expect(route).toMatch(/guard\.form\.get\("invitationId"\)/)
    expect(route).toContain("invitationId: body.invitationId")
  })

  it("is cleared with the rest of the pre-auth state", () => {
    expect(preAuthCookieNames).toContain("__Host-console-pre-auth-inv")
  })
})

describe("the identifier is treated as opaque", () => {
  it("accepts what the backend issues and refuses what it does not", () => {
    expect(OPAQUE_INVITATION_ID.test("2075c072-5208-4164-b57f-bc135bb57f8c")).toBe(true)
    expect(OPAQUE_INVITATION_ID.test("AbC_-123")).toBe(true)
    expect(OPAQUE_INVITATION_ID.test("")).toBe(false)
    expect(OPAQUE_INVITATION_ID.test("has space")).toBe(false)
    expect(OPAQUE_INVITATION_ID.test("../escape")).toBe(false)
    expect(OPAQUE_INVITATION_ID.test("x".repeat(129))).toBe(false)
  })
})
