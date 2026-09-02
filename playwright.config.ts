import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { defineConfig, devices } from "@playwright/test"

const LOCAL_HOSTNAME = "console.evirion.test"
const LOCAL_PORT = 3443
const LOCAL_ORIGIN = `https://${LOCAL_HOSTNAME}:${LOCAL_PORT}`

/**
 * The Console API double. It shares the local leaf, whose subject alternative
 * names already cover the loopback address, so the Console reaches it over
 * real TLS with `NODE_EXTRA_CA_CERTS` rather than by relaxing verification.
 */
const STUB_PORT = 3444
const STUB_ORIGIN = `https://127.0.0.1:${STUB_PORT}`

const spkiPinPath = new URL("./tools/local-tls/.local/spki-pin.txt", import.meta.url)
const authorityPath = new URL("./tools/local-tls/.local/authority.pem", import.meta.url)

const readSpkiPin = (): string => {
  try {
    return readFileSync(fileURLToPath(spkiPinPath), "utf8").trim()
  } catch {
    throw new Error(
      "local TLS material is missing; run `pnpm tls:generate` before the browser gate",
    )
  }
}

/**
 * The browser gate runs against the pinned HTTPS origin, so `__Host-` and
 * `Secure` behave exactly as they do in staging. The hostname is resolved by
 * Chromium rather than by an /etc/hosts entry, and this one leaf is trusted by
 * SPKI pin rather than by installing a certificate authority into the system
 * trust store. `ignoreHTTPSErrors` stays off: a test must never pass by
 * weakening the cookie contract it exists to prove.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: ["security/**/*.spec.ts", "e2e/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: LOCAL_ORIGIN,
    ignoreHTTPSErrors: false,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            `--host-resolver-rules=MAP ${LOCAL_HOSTNAME} 127.0.0.1`,
            `--ignore-certificate-errors-spki-list=${readSpkiPin()}`,
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command: "node tools/console-stub/server.mjs",
      url: `${STUB_ORIGIN}/__stub/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      ignoreHTTPSErrors: true,
      env: { CONSOLE_STUB_PORT: String(STUB_PORT) },
    },
    {
      command: "node tools/local-tls/serve.mjs",
      // The readiness probe runs in Node, where --host-resolver-rules does not
      // apply and console.evirion.test has no DNS record. The probe therefore
      // uses the loopback address; every test still runs against LOCAL_ORIGIN
      // through the browser, so the __Host- and Secure contract is unaffected.
      url: `https://127.0.0.1:${LOCAL_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      ignoreHTTPSErrors: true,
      env: {
        NODE_EXTRA_CA_CERTS: fileURLToPath(authorityPath),
        CONSOLE_CANONICAL_ORIGIN: LOCAL_ORIGIN,
        CONSOLE_TRUSTED_PROXY_HOPS: "1",
        SUPABASE_URL: "https://project.supabase.test",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture",
        CONSOLE_API_BASE_URL: STUB_ORIGIN,
        // Documented public test fixtures. They sign nothing outside this
        // harness and are not credentials for any real environment.
        CONSOLE_CSRF_SIGNING_KEY: "console-local-test-csrf-signing-key-0001",
        CONSOLE_BFF_PROOF_SIGNING_KEY: "console-local-test-proof-signing-key-001",
      },
    },
  ],
})
