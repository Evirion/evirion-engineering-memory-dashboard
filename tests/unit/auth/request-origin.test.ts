import { describe, expect, it } from "vitest"

import {
  type MutationRequest,
  assertMutationOrigin,
  resolveSafeRedirect,
} from "@/lib/security/request-origin"

const CANONICAL = "https://console.evirion.test:3443"
const POLICY = { canonicalOrigin: CANONICAL, trustedProxyHops: 1 }

const request = (
  headers: Record<string, string>,
  {
    method = "POST",
    viaTrustedProxy = true,
  }: Partial<Omit<MutationRequest, "headers">> = {},
): MutationRequest => ({
  method,
  headers: new Headers(headers),
  viaTrustedProxy,
})

const goodHeaders = {
  origin: CANONICAL,
  host: "console.evirion.test:3443",
  "x-forwarded-host": "console.evirion.test:3443",
  "x-forwarded-proto": "https",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "same-origin",
  "content-type": "application/json",
}

describe("state-changing request boundary", () => {
  it("allows an exact same-origin JSON mutation through the trusted edge", () => {
    expect(assertMutationOrigin(request(goodHeaders), POLICY)).toEqual({
      allowed: true,
      origin: CANONICAL,
    })
  })

  it("allows the allowlisted form encodings", () => {
    for (const contentType of [
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=abc",
      "application/json; charset=utf-8",
    ]) {
      expect(
        assertMutationOrigin(
          request({ ...goodHeaders, "content-type": contentType }),
          POLICY,
        ),
      ).toEqual({ allowed: true, origin: CANONICAL })
    }
  })

  it("refuses a safe method, so this can never be mistaken for a read guard", () => {
    expect(
      assertMutationOrigin(request(goodHeaders, { method: "GET" }), POLICY),
    ).toEqual({
      allowed: false,
      reason: "method-not-allowed",
    })
  })

  it("refuses a cross-site form post", () => {
    expect(
      assertMutationOrigin(
        request({
          ...goodHeaders,
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        }),
        POLICY,
      ),
    ).toEqual({ allowed: false, reason: "origin-mismatch" })
  })

  it("refuses a sibling subdomain", () => {
    expect(
      assertMutationOrigin(
        request({ ...goodHeaders, origin: "https://evil.console.evirion.test:3443" }),
        POLICY,
      ),
    ).toEqual({ allowed: false, reason: "origin-mismatch" })
  })

  it("refuses a null or absent Origin rather than treating it as same-origin", () => {
    expect(
      assertMutationOrigin(request({ ...goodHeaders, origin: "null" }), POLICY),
    ).toEqual({ allowed: false, reason: "origin-mismatch" })

    const { origin: _omitted, ...withoutOrigin } = goodHeaders
    expect(assertMutationOrigin(request(withoutOrigin), POLICY)).toEqual({
      allowed: false,
      reason: "missing-origin",
    })
  })

  it("refuses a host that is not the canonical origin", () => {
    expect(
      assertMutationOrigin(
        request({ ...goodHeaders, "x-forwarded-host": "console.evirion.test:9999" }),
        POLICY,
      ),
    ).toEqual({ allowed: false, reason: "host-mismatch" })
  })

  it("refuses a downgraded forwarded protocol", () => {
    expect(
      assertMutationOrigin(
        request({ ...goodHeaders, "x-forwarded-proto": "http" }),
        POLICY,
      ),
    ).toEqual({ allowed: false, reason: "host-mismatch" })
  })

  it.each(["forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-for"])(
    "refuses a client-supplied %s when the request did not come through the edge",
    (header) => {
      expect(
        assertMutationOrigin(
          request(
            {
              origin: CANONICAL,
              host: "console.evirion.test:3443",
              [header]: "spoofed",
            },
            { viaTrustedProxy: false },
          ),
          POLICY,
        ),
      ).toEqual({ allowed: false, reason: "untrusted-forwarding-header" })
    },
  )

  it("evaluates a direct request on its own Host", () => {
    expect(
      assertMutationOrigin(
        request(
          {
            origin: CANONICAL,
            host: "console.evirion.test:3443",
            "sec-fetch-site": "same-origin",
            "content-type": "application/json",
          },
          { viaTrustedProxy: false },
        ),
        POLICY,
      ),
    ).toEqual({ allowed: true, origin: CANONICAL })
  })

  it.each(["cross-site", "same-site", "none", undefined])(
    "refuses Sec-Fetch-Site %s",
    (site) => {
      const headers: Record<string, string> = { ...goodHeaders }
      if (site === undefined) delete headers["sec-fetch-site"]
      else headers["sec-fetch-site"] = site

      expect(assertMutationOrigin(request(headers), POLICY)).toEqual({
        allowed: false,
        reason: "fetch-metadata-mismatch",
      })
    },
  )

  it.each(["text/plain", "text/html", "application/xml", undefined])(
    "refuses content type %o",
    (contentType) => {
      const headers: Record<string, string> = { ...goodHeaders }
      if (contentType === undefined) delete headers["content-type"]
      else headers["content-type"] = contentType

      expect(assertMutationOrigin(request(headers), POLICY)).toEqual({
        allowed: false,
        reason: "content-type-not-allowed",
      })
    },
  )
})

describe("safe redirect allowlist", () => {
  it("keeps a same-origin path", () => {
    expect(resolveSafeRedirect("/onboarding")).toBe("/onboarding")
    expect(resolveSafeRedirect("/memory?filter=open")).toBe("/memory?filter=open")
  })

  // Assembled rather than written literally so the linter's script-url rule
  // does not flag the very strings this test exists to refuse.
  const scriptScheme = `java${"script"}:alert(1)`

  it.each([
    "https://evil.example",
    "http://evil.example",
    "//evil.example",
    "/\\evil.example",
    scriptScheme,
    `/${scriptScheme}`,
    "data:text/html,x",
    "",
    null,
    undefined,
  ])("refuses %o and falls back to the root", (candidate) => {
    expect(resolveSafeRedirect(candidate)).toBe("/")
  })

  it("refuses a target carrying a control character", () => {
    expect(resolveSafeRedirect("/onboarding\n/evil")).toBe("/")
    expect(resolveSafeRedirect("/onboarding\u0000")).toBe("/")
  })
})
