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

  it("routes every redirect through the canonical origin helper", () => {
    const routes = collectSourceFiles("src").filter((path) => path.includes("/api/"))

    expect(routes.length).toBeGreaterThan(0)
    for (const path of routes) {
      const source = readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")
      if (!source.includes("NextResponse.redirect")) continue

      expect(source, `${path} must use canonicalRedirect`).toContain(
        "canonicalRedirect",
      )
    }
  })
})
