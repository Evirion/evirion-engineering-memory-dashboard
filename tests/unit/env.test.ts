import { describe, expect, it } from "vitest"

import { ClientEnvironmentError, readClientEnvironment } from "@/lib/env/client"
import {
  BROWSER_FORBIDDEN_VARIABLES,
  type EnvironmentSource,
  ServerEnvironmentError,
  assertNoPublicSecrets,
  readServerEnvironment,
} from "@/lib/env/server"

// A deliberately low-entropy, self-describing fixture. It signs nothing
// outside this suite and is not a credential for any environment.
const SIGNING_KEY = "console-unit-test-signing-key-not-a-secret"

const validServerEnvironment = (): EnvironmentSource => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture",
  CONSOLE_API_BASE_URL: "https://api.evirion.test",
  CONSOLE_GITHUB_APP_INSTALL_URL:
    "https://github.com/apps/evirion-local/installations/new",
  CONSOLE_CANONICAL_ORIGIN: "https://console.evirion.test:3443",
  CONSOLE_CSRF_SIGNING_KEY: SIGNING_KEY,
  CONSOLE_BFF_PROOF_SIGNING_KEY: SIGNING_KEY,
})

describe("server environment boundary", () => {
  it("accepts a complete configuration", () => {
    const environment = readServerEnvironment(validServerEnvironment())

    expect(environment.canonicalOrigin).toBe("https://console.evirion.test:3443")
    expect(environment.trustedProxyHops).toBe(1)
  })

  it.each([
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "CONSOLE_API_BASE_URL",
    "CONSOLE_GITHUB_APP_INSTALL_URL",
    "CONSOLE_CANONICAL_ORIGIN",
    "CONSOLE_CSRF_SIGNING_KEY",
    "CONSOLE_BFF_PROOF_SIGNING_KEY",
  ])("fails startup when %s is missing", (name) => {
    const source = validServerEnvironment()
    delete source[name]

    expect(() => readServerEnvironment(source)).toThrow(ServerEnvironmentError)
  })

  it.each([
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "CONSOLE_API_BASE_URL",
    "CONSOLE_GITHUB_APP_INSTALL_URL",
    "CONSOLE_CANONICAL_ORIGIN",
    "CONSOLE_CSRF_SIGNING_KEY",
    "CONSOLE_BFF_PROOF_SIGNING_KEY",
  ])("fails startup when %s is blank", (name) => {
    const source = { ...validServerEnvironment(), [name]: "   " }

    expect(() => readServerEnvironment(source)).toThrow(ServerEnvironmentError)
  })

  it.each(["CONSOLE_CSRF_SIGNING_KEY", "CONSOLE_BFF_PROOF_SIGNING_KEY"])(
    "fails startup when %s carries fewer than 256 bits",
    (name) => {
      const source = { ...validServerEnvironment(), [name]: "too-short-secret" }

      expect(() => readServerEnvironment(source)).toThrow(/256 bits/)
    },
  )

  it("rejects a non-https origin so the __Host- cookie contract cannot weaken", () => {
    const source = {
      ...validServerEnvironment(),
      CONSOLE_CANONICAL_ORIGIN: "http://console.evirion.test:3443",
    }

    expect(() => readServerEnvironment(source)).toThrow(/must use https/)
  })

  it("rejects an origin carrying a path, query or fragment", () => {
    for (const value of [
      "https://console.evirion.test:3443/console",
      "https://console.evirion.test:3443/?tenant=a",
      "https://console.evirion.test:3443/#x",
    ]) {
      const source = { ...validServerEnvironment(), CONSOLE_CANONICAL_ORIGIN: value }

      expect(() => readServerEnvironment(source)).toThrow(/exactly one origin/)
    }
  })

  it("rejects more than the one trusted edge hop the baseline fixes", () => {
    const source = { ...validServerEnvironment(), CONSOLE_TRUSTED_PROXY_HOPS: "2" }

    expect(() => readServerEnvironment(source)).toThrow(/must be 1/)
  })

  it.each([...BROWSER_FORBIDDEN_VARIABLES])(
    "refuses to start when %s is exposed as NEXT_PUBLIC_",
    (name) => {
      const source = { ...validServerEnvironment(), [`NEXT_PUBLIC_${name}`]: "leaked" }

      expect(() => readServerEnvironment(source)).toThrow(/browser-exposed/)
    },
  )

  it.each([
    "NEXT_PUBLIC_SOME_SERVICE_ROLE",
    "NEXT_PUBLIC_TENANT_SECRET",
    "NEXT_PUBLIC_SIGNING_KEY",
    "NEXT_PUBLIC_WAREHOUSE_DSN",
    "NEXT_PUBLIC_PROVIDER_API_KEY",
    "NEXT_PUBLIC_ADMIN_TOKEN",
  ])("refuses an unlisted secret-shaped browser variable %s", (name) => {
    expect(() => assertNoPublicSecrets({ [name]: "leaked" })).toThrow(/browser-exposed/)
  })
})

describe("client environment allowlist", () => {
  it("defaults to the local environment", () => {
    expect(readClientEnvironment({}).environment).toBe("local")
  })

  it("exposes no Supabase session configuration", () => {
    expect(() =>
      readClientEnvironment({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" }),
    ).toThrow(ClientEnvironmentError)
    expect(() =>
      readClientEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "https://x" }),
    ).toThrow(ClientEnvironmentError)
  })

  it("rejects an unknown environment name", () => {
    expect(() =>
      readClientEnvironment({ NEXT_PUBLIC_CONSOLE_ENVIRONMENT: "preview" }),
    ).toThrow(/must be one of/)
  })

  it("ignores server-only variables that carry no NEXT_PUBLIC_ prefix", () => {
    expect(
      readClientEnvironment({
        SUPABASE_SERVICE_ROLE_KEY: "server-only",
        NEXT_PUBLIC_CONSOLE_ENVIRONMENT: "staging",
      }).environment,
    ).toBe("staging")
  })
})
