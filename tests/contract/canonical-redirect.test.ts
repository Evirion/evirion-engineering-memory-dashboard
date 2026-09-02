import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { collectSourceFiles, repositoryRoot } from "../support/source-tree"

/**
 * A redirect must never be derived from `request.url`.
 *
 * Behind the trusted edge, `request.url` carries the internal upstream host.
 * A redirect built from it leaves the canonical origin, and the browser then
 * refuses to follow it. That defect reached the browser gate once, so the
 * prohibition is asserted rather than remembered.
 */
describe("canonical redirect boundary", () => {
  it("builds no redirect from request.url in any route handler", () => {
    const offenders = collectSourceFiles("src")
      .filter((path) => path.includes("/api/"))
      .filter((path) => {
        const source = readFileSync(
          fileURLToPath(new URL(path, repositoryRoot)),
          "utf8",
        )
        return /NextResponse\.redirect\([^)]*request\.url/.test(source)
      })

    expect(offenders).toEqual([])
  })

  it("routes every redirect through a reviewed origin helper", () => {
    // Two helpers, and no third. `canonicalRedirect` covers every same-origin
    // destination; `githubInstallRedirect` covers the single off-origin one,
    // the GitHub App handoff, which cannot be a path. Both derive the origin
    // from reviewed configuration, which is the property that matters.
    const helpers = ["canonicalRedirect", "githubInstallRedirect"]
    const routes = collectSourceFiles("src").filter((path) => path.includes("/api/"))

    expect(routes.length).toBeGreaterThan(0)
    for (const path of routes) {
      const source = readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")
      if (!source.includes("NextResponse.redirect")) continue

      expect(
        helpers.some((helper) => source.includes(helper)),
        `${path} must redirect through a reviewed origin helper`,
      ).toBe(true)
    }
  })

  it("keeps the off-origin helper out of every route but the GitHub handoff", () => {
    const users = collectSourceFiles("src").filter((path) => {
      const source = readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")
      return path.includes("/api/") && source.includes("githubInstallRedirect")
    })

    expect(users).toEqual(["src/app/api/github/connect/route.ts"])
  })
})
