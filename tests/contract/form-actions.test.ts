import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { collectSourceFiles, repositoryRoot } from "../support/source-tree"

/**
 * Every form must post somewhere that exists.
 *
 * Five forms once pointed at route handlers that were never written, so the
 * controls rendered and then returned `404`. Nothing in lint, typecheck, the
 * build or the route guard could see it: the guard checks that routes are
 * declared, not that referenced routes exist. This closes that direction.
 */
const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")

const resolveHandlerUrl = (file: string): string => {
  const segments = file.slice("src/app/".length).split("/").slice(0, -1)
  const parts = segments.filter(
    (segment) => !(segment.startsWith("(") && segment.endsWith(")")),
  )
  return `/${parts.join("/")}`
}

describe("form actions", () => {
  const sources = collectSourceFiles("src")

  const handlerUrls = new Set(
    sources
      .filter((file) => /\/route\.tsx?$/.test(file))
      .map((file) => resolveHandlerUrl(file)),
  )

  const actions = sources
    .filter((file) => file.endsWith(".tsx"))
    .flatMap((file) =>
      [...read(file).matchAll(/action="(\/[^"]*)"/g)].map((match) => ({
        file,
        action: match[1] as string,
      })),
    )

  it("finds the forms this suite exists to check", () => {
    expect(actions.length).toBeGreaterThan(0)
    expect(handlerUrls.size).toBeGreaterThan(0)
  })

  it("posts only to a route handler that exists", () => {
    const dangling = actions
      .filter(({ action }) => !handlerUrls.has(action))
      .map(({ file, action }) => `${file} -> ${action}`)

    expect(dangling).toEqual([])
  })

  it("posts only to the same-origin BFF prefix", () => {
    const offOrigin = actions
      .filter(({ action }) => !action.startsWith("/api/"))
      .map(({ file, action }) => `${file} -> ${action}`)

    expect(offOrigin).toEqual([])
  })

  it("carries a CSRF proof in every form that posts", () => {
    const withoutProof = sources
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => {
        const source = read(file)
        if (!/action="\/api\//.test(source)) return false
        return !source.includes('name="csrfToken"')
      })

    expect(withoutProof).toEqual([])
  })
})
