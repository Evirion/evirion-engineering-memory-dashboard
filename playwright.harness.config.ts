import { defineConfig } from "@playwright/test"

import base from "./playwright.config"

/**
 * The visual harnesses, which are tools rather than gates.
 *
 * `tests/e2e/*.harness.ts` open a signed-in browser and capture screenshots so
 * the Console can be reviewed by hand. They assert nothing, so running them in
 * CI would add always-green tests that lengthen the gate and prove nothing.
 * The default config's `testMatch` allowlist ends in `.spec.ts` and therefore
 * cannot see them — which also means Playwright refuses to run them even when
 * the path is given explicitly, hence this file.
 *
 * Everything else is inherited: the same pinned HTTPS origin, the same SPKI
 * pin and host-resolver rules, and the same stub and TLS `webServer` pair. A
 * harness that reached a different stack than the gate would be showing
 * something other than what is being tested.
 *
 *   pnpm harness                                  every harness
 *   pnpm harness --grep "@visual repositories"    one capture
 */
export default defineConfig({
  ...base,
  testMatch: ["e2e/**/*.harness.ts"],
})
