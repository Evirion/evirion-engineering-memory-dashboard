import { expect, test, type Page } from "@playwright/test"

import {
  FOREIGN_KNOWLEDGE,
  FOREIGN_REPOSITORY,
} from "../../tools/console-stub/fixtures.mjs"
import { signIn } from "../support/session-fixture"

/**
 * Broken access control, BOLA and BFLA, security row SEC-WEB-001.
 *
 * The existing boundary specs each prove their own surface. This one is the
 * matrix: every identifier-bearing route crossed with a foreign tenant, and
 * every capability-gated control crossed with a role that lacks it.
 *
 * Two properties are held throughout. A foreign resource is refused exactly as
 * an absent one, so the answer is never an oracle. And a control a role cannot
 * use is absent rather than present-and-refused, because a visible control that
 * fails is an invitation to look for the request behind it.
 */

const FOREIGN = FOREIGN_REPOSITORY
const ABSENT = "00000000-0000-4000-8000-00000000dead"

const IDENTIFIER_ROUTES = [
  (id: string) => `/repositories/${id}`,
  (id: string) => `/repositories/${id}/import`,
  (id: string) => `/repositories/${id}/memory`,
] as const

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * The settled refusal, with the per-request reference masked.
 *
 * A support reference differs by design and is not an oracle. What must not
 * differ is everything else, so the wait is for the page to stop loading rather
 * than for a timeout to expire.
 */
const settledRefusal = async (page: Page, target: string): Promise<string> => {
  const response = await page.goto(target)
  await expect(page.getByText(/Loading/i)).toHaveCount(0)
  const text = (await page.locator("body").innerText())
    .replaceAll(/\s+/g, " ")
    .replaceAll(UUID_PATTERN, "<reference>")
    .trim()
  return `${response?.status() ?? 0} ${text}`
}

test.describe("a foreign identifier is indistinguishable from an absent one", () => {
  for (const [index, build] of IDENTIFIER_ROUTES.entries()) {
    test(`route ${index + 1} answers a foreign tenant exactly as it answers nothing`, async ({
      context,
      page,
    }) => {
      await signIn(context, { scenario: "default" })

      expect(await settledRefusal(page, build(FOREIGN))).toBe(
        await settledRefusal(page, build(ABSENT)),
      )
    })
  }

  test("a foreign knowledge object is refused exactly as an absent one", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })

    expect(
      await settledRefusal(page, `/memory/${FOREIGN_KNOWLEDGE.knowledgeObject}`),
    ).toBe(await settledRefusal(page, `/memory/${ABSENT}`))
  })
})

test.describe("a capability a role lacks has no control", () => {
  const CAPABILITY_CONTROLS = [
    { route: "/memory", name: /approve|reject|supersede|correct/i },
    { route: "/repositories", name: /activate|disable|request change/i },
    { route: "/settings/members", name: /invite|remove|change role/i },
    { route: "/settings/github", name: /connect|disconnect|synchron/i },
  ] as const

  for (const { route, name } of CAPABILITY_CONTROLS) {
    test(`${route} shows a viewer no control it may not use`, async ({
      context,
      page,
    }) => {
      await signIn(context, { principal: "console-stub-viewer", scenario: "default" })
      await page.goto(route)
      // Absent, not disabled: a disabled control still tells a reader the
      // request exists and is worth forging.
      expect(await page.getByRole("button", { name }).count()).toBe(0)
    })
  }
})

test.describe("authority never comes from the caller", () => {
  test("an organization supplied in the query changes nothing", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })

    expect(
      await settledRefusal(
        page,
        "/repositories?organizationId=00000000-0000-4000-8000-0000000000b1",
      ),
    ).toBe(await settledRefusal(page, "/repositories"))
  })

  test("no document carries a caller token or session material", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })
    for (const route of ["/repositories", "/memory", "/settings/members"]) {
      await page.goto(route)
      const content = await page.content()
      for (const marker of [
        "console-stub-owner|",
        "Bearer ",
        "service_role",
        "sb_secret",
      ]) {
        expect(content.includes(marker), `${route} leaks ${marker}`).toBe(false)
      }
    }
  })
})
