import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  GithubInstallRedirectError,
  githubInstallRedirect,
} from "@/server/actions/redirects"

/**
 * EEM-9/03 C03-6.
 *
 * The GitHub App handoff is the only redirect that leaves the Console origin,
 * so the property `canonicalRedirect` protects has to be proved a second way:
 * the destination comes from configuration, and the one caller-influenced part
 * is refused unless it is exactly a setup-intent nonce.
 */

const STATE = "a".repeat(64)

const environment = {
  CONSOLE_CANONICAL_ORIGIN: "https://console.evirion.test:3443",
  CONSOLE_API_BASE_URL: "https://api.evirion.test",
  CONSOLE_GITHUB_APP_INSTALL_URL: "https://github.com/apps/evirion/installations/new",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture",
  CONSOLE_CSRF_SIGNING_KEY: "c".repeat(48),
  CONSOLE_BFF_PROOF_SIGNING_KEY: "p".repeat(48),
}

beforeEach(() => {
  Object.assign(process.env, environment)
})

afterEach(() => {
  for (const name of Object.keys(environment)) delete process.env[name]
})

describe("the GitHub App handoff", () => {
  it("builds the destination from configuration, not from the request", () => {
    const destination = githubInstallRedirect(STATE)

    expect(destination.origin).toBe("https://github.com")
    expect(destination.pathname).toBe("/apps/evirion/installations/new")
    expect(destination.searchParams.get("state")).toBe(STATE)
  })

  it.each([
    "",
    "not-hex",
    "A".repeat(64),
    "a".repeat(63),
    "a".repeat(65),
    "../../evil",
    "https://attacker.example/",
  ])("refuses a state that is not a setup-intent nonce: %s", (state) => {
    expect(() => githubInstallRedirect(state)).toThrow(GithubInstallRedirectError)
  })

  it("cannot be steered to another host by the state", () => {
    // Even a state shaped to look like a URL only ever lands in the query of
    // the configured destination, and here it is refused outright.
    expect(() => githubInstallRedirect("https://attacker.example")).toThrow()
    expect(githubInstallRedirect(STATE).host).toBe("github.com")
  })
})
