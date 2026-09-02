import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { BROWSER_FORBIDDEN_VARIABLES } from "@/lib/env/server"
import { collectSourceFiles, repositoryRoot } from "../support/source-tree"

/**
 * SEC-WEB-008 and NFR-SEC-001. These assert properties of every module rather
 * than a list of known-bad files, so a new file cannot opt out by being new.
 */
describe("browser secret boundary", () => {
  const clientModules = collectSourceFiles("src").filter((path) => {
    const source = readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")
    return source.includes('"use client"') || source.includes("'use client'")
  })

  const allModules = collectSourceFiles("src")

  it("reads process.env only inside the two environment modules", () => {
    const offenders = allModules.filter((path) => {
      if (path === "src/lib/env/server.ts" || path === "src/lib/env/client.ts") {
        return false
      }
      const source = readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")
      // The proxy reads only NODE_ENV, which Next inlines and which carries no
      // tenant or credential meaning.
      const withoutNodeEnv = source.replaceAll("process.env.NODE_ENV", "")
      return withoutNodeEnv.includes("process.env")
    })

    expect(offenders).toEqual([])
  })

  it("names no forbidden secret in any client module", () => {
    const offenders: string[] = []
    for (const path of clientModules) {
      const source = readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")
      for (const name of BROWSER_FORBIDDEN_VARIABLES) {
        if (source.includes(name)) {
          offenders.push(`${path}: ${name}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it("initializes no session-bearing Supabase client in a client module", () => {
    const offenders = clientModules.filter((path) => {
      const source = readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")
      return /@supabase\/(ssr|supabase-js)/.test(source)
    })

    expect(offenders).toEqual([])
  })

  it("renders no raw HTML anywhere", () => {
    const offenders = allModules.filter((path) => {
      const source = readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")
      return (
        source.includes("dangerouslySetInnerHTML") ||
        source.includes("innerHTML") ||
        /\bjavascript:/.test(source)
      )
    })

    expect(offenders).toEqual([])
  })
})
