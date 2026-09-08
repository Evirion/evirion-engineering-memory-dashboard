import { test } from "@playwright/test"

import { signIn } from "../support/session-fixture"
import type { StubScenarioName } from "../../tools/console-stub/fixtures.mjs"

/**
 * Not a gate. Opens a real, signed-in browser against the local stack so the
 * Console can be clicked through by hand.
 *
 *   pnpm exec playwright test tests/e2e/browse.spec.ts --headed --grep @browse
 *
 * It exists because neither of the ordinary routes works for a person. The
 * canonical origin must be https, so `next dev` on plain localhost is refused
 * at startup; and the stub auth provider answers `denied` to an OTP
 * verification, so the sign-in form cannot mint a session. This reuses the
 * harness that already solves all three problems: Chromium resolves the pinned
 * hostname through `--host-resolver-rules`, trusts the local leaf by SPKI pin
 * rather than by touching the system trust store, and the fixture writes the
 * session cookie in the product's own format.
 *
 * The scenario is fixed at sign-in and keyed to the isolation token printed
 * below. Loading a different one against that same token and refreshing the
 * page changes what the stack serves without restarting anything.
 */
const SCENARIO = (process.env.BROWSE_SCENARIO ?? "default") as StubScenarioName

test("@browse console", async ({ context, page }) => {
  // The browser stays open until the process is stopped, so no deadline.
  test.setTimeout(0)

  const session = await signIn(context, { scenario: SCENARIO })

  console.log("\n  Console is up. Sign-in is already done.")
  console.log(`  scenario:  ${SCENARIO}`)
  console.log(`  isolation: ${session.isolation}`)
  console.log("\n  Click through the sidebar. Close the window to stop.\n")

  await page.goto("/repositories")

  await new Promise(() => {})
})
