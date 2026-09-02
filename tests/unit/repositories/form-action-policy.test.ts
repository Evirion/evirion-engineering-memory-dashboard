import { describe, expect, it } from "vitest"

import { buildContentSecurityPolicy } from "@/lib/security/headers"

/**
 * EEM-9/03 C03-6.
 *
 * Chrome applies `form-action` to the whole redirect chain, so a form posting
 * same-origin and then redirected to GitHub is refused unless GitHub is named.
 * Exactly one destination may be named, it comes from configuration, and
 * widening it any further has to fail here.
 */

const directive = (policy: string): string =>
  policy.split("; ").find((part) => part.startsWith("form-action ")) as string

describe("the form-action directive", () => {
  it("is self alone when no handoff is configured", () => {
    expect(directive(buildContentSecurityPolicy("n", { isProduction: true }))).toBe(
      "form-action 'self'",
    )
  })

  it("names the configured handoff origin and nothing more of it", () => {
    const policy = buildContentSecurityPolicy("n", {
      isProduction: true,
      formActionOrigins: ["https://github.com/apps/evirion/installations/new"],
    })

    // The origin only: a path in the policy would be meaningless and a wider
    // host would admit destinations nobody reviewed.
    expect(directive(policy)).toBe("form-action 'self' https://github.com")
  })

  it("refuses to admit an insecure origin", () => {
    const policy = buildContentSecurityPolicy("n", {
      isProduction: true,
      formActionOrigins: ["http://github.com/apps/evirion/installations/new"],
    })

    expect(directive(policy)).toBe("form-action 'self'")
  })

  it("leaves every other directive exactly as it was", () => {
    const policy = buildContentSecurityPolicy("n", {
      isProduction: true,
      formActionOrigins: ["https://github.com/apps/evirion/installations/new"],
    })

    expect(policy).toContain("default-src 'none'")
    expect(policy).toContain("base-uri 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).not.toContain("unsafe-inline")
    expect(policy).not.toContain("unsafe-eval")
    // Widening form-action must not widen anything a script could use.
    expect(policy).toContain("script-src 'nonce-n' 'strict-dynamic'")
    expect(policy).toContain("connect-src 'self'")
  })
})
