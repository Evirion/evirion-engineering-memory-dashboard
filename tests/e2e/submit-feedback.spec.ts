import { expect, test } from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * Every mutation here is a native form post that navigates the page, so the
 * only feedback the platform gives is the tab throbber. On a slow backend a
 * customer reasonably concludes nothing happened and presses again.
 * `SubmitButton` closes that, and these two rows hold the parts of it that
 * would fail silently.
 */
test.describe("a submitted form says it is working", () => {
  test("marks the pressed control busy and shows a spinner", async ({ page }) => {
    // Hold the response open so the in-flight state can be observed at all.
    // Delayed rather than aborted: an abort tears the document down, and the
    // point here is what the page looks like while it is still waiting.
    await page.route("**/api/auth/request-otp", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await route.fulfill({ status: 204 })
    })

    await page.goto("/auth/sign-in")
    await page.getByLabel("Email address").fill("partner@northwind.example")

    const submit = page.getByRole("button", { name: "Send code" })
    await expect(submit).toHaveAttribute("aria-busy", "false")

    /*
     * The control is a client leaf on a server-rendered page, so its submit
     * listener exists only once React has hydrated. Before that the form
     * still posts — it is a plain form and works without JavaScript — it just
     * posts without the spinner. Waiting here tests the enhanced path rather
     * than racing it.
     */
    await expect
      .poll(async () =>
        submit.evaluate((node) => node.getAttribute("aria-busy") !== null),
      )
      .toBe(true)
    await page.waitForLoadState("networkidle")

    await submit.click()

    await expect(submit).toHaveAttribute("aria-busy", "true")
    await expect(submit.locator("svg.animate-spin")).toBeVisible()
    // The label survives. A control that blanks its own text while working
    // removes the only thing saying what is running.
    await expect(submit).toContainText("Send code")
  })

  test("still sends the pressed button's own value", async ({ context, page }) => {
    /*
     * The guard on the whole design. Two controls on this page share one form
     * and are told apart by `name="selection"`, so the submitter is
     * load-bearing. Disabling it to show the spinner would drop it from the
     * form data — the browser skips disabled controls when it builds the
     * entry list — and the request would arrive without the value that says
     * which sessions to end. `SubmitButton` therefore never sets `disabled`.
     */
    await signIn(context)

    const submitted = new Promise<string>((resolve) => {
      page.on("request", (request) => {
        if (request.url().endsWith("/api/auth/sessions/revoke")) {
          resolve(request.postData() ?? "")
        }
      })
    })
    await page.route("**/api/auth/sessions/revoke", (route) => route.abort())

    await page.goto("/settings/sessions")
    await page.getByRole("button", { name: "Sign out other sessions" }).click()

    expect(await submitted).toContain("selection=others")
  })
})
