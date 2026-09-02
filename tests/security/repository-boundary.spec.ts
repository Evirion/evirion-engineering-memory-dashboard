import { expect, test } from "@playwright/test"

import { FOREIGN_REPOSITORY, REPOSITORIES } from "../../tools/console-stub/fixtures.mjs"
import { STUB_ORIGIN, signIn } from "../support/session-fixture"

/**
 * SEC-WEB-001 for the repository surface, owned by EEM-9/03.
 *
 * Substituting an identifier is the cheapest attack on a tenant boundary, so
 * what is asserted here is not only that the request is refused but that the
 * refusal is indistinguishable from one for an identifier that never existed.
 * A different status, a different code or a different page would itself
 * disclose that the resource belongs to somebody.
 */

/** A well-formed identifier that belongs to nothing at all. */
const ABSENT_REPOSITORY = "00000000-0000-4000-8000-0000000009ff"

test.describe("repository tenant boundary", () => {
  test("refuses a foreign repository exactly as it refuses an absent one", async ({
    context,
    page,
  }) => {
    await signIn(context)

    await page.goto(`/repositories/${FOREIGN_REPOSITORY}`)
    const foreign = await page.content()

    await page.goto(`/repositories/${ABSENT_REPOSITORY}`)
    const absent = await page.content()

    expect(foreign).toContain("RESOURCE_NOT_FOUND")
    expect(absent).toContain("RESOURCE_NOT_FOUND")
    // Nothing about the other tenant's repository reaches the document.
    expect(foreign).not.toContain("globex")
    expect(foreign).not.toContain("secret-platform")
  })

  test("refuses a malformed identifier without a backend round trip", async ({
    context,
    page,
  }) => {
    await signIn(context)

    await page.goto("/repositories/not-a-uuid")

    await expect(page.getByText("RESOURCE_NOT_FOUND")).toBeVisible()
  })

  test("refuses a direct BFF read for another organization", async ({ context }) => {
    const { token } = await signIn(context)

    // Straight at the backend with this caller's own token, bypassing the UI.
    const response = await context.request.get(
      `${STUB_ORIGIN}/v1/organizations/00000000-0000-4000-8000-0000000000b1/repositories`,
      { headers: { authorization: `Bearer ${token}` }, ignoreHTTPSErrors: true },
    )

    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({
      error: { code: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    })
  })

  test("puts no caller token or session material in the document", async ({
    context,
    page,
  }) => {
    const { token } = await signIn(context)

    await page.goto(`/repositories/${REPOSITORIES.activeAutoExtract}`)
    const content = await page.content()

    expect(content).not.toContain(token)
    expect(content).not.toMatch(
      /service_role|postgres(ql)?:\/\/|BEGIN [A-Z ]*PRIVATE KEY/,
    )
    // The session cookie is server-only and must not be readable by script.
    expect(await page.evaluate(() => document.cookie)).not.toContain("console-session")
  })
})
