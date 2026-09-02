import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { repositoryRoot } from "../support/source-tree"

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8")

const readJson = <T>(relative: string): T => JSON.parse(read(relative)) as T

type ToolchainBaseline = {
  actions: Record<string, { commit: string; version: string }>
  packages: Record<string, string>
  packageManagers: Record<string, string>
  registries: Record<string, string>
  runtime: { node: string }
}

type PackageManifest = {
  packageManager: string
  engines: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

/**
 * SEC-WEB-007. The baseline is the pin of record; this proves the manifest,
 * the runtime files and CI cannot drift away from it independently.
 */
describe("supply chain policy", () => {
  const baseline = readJson<ToolchainBaseline>(
    "docs/architecture/toolchain-baseline.json",
  )
  const manifest = readJson<PackageManifest>("package.json")
  const declared = { ...manifest.dependencies, ...manifest.devDependencies }

  it("pins every baseline package to the exact baseline version", () => {
    const drift = Object.entries(baseline.packages)
      .filter(([name]) => name in declared)
      .filter(([name, version]) => declared[name] !== version)
      .map(([name, version]) => `${name}: expected ${version}, found ${declared[name]}`)

    expect(drift).toEqual([])
  })

  it("declares every dependency as an exact version, never a range", () => {
    const ranged = Object.entries(declared)
      .filter(([, version]) => !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
      .map(([name, version]) => `${name}@${version}`)

    expect(ranged).toEqual([])
  })

  it("pins the runtime and package manager to the baseline", () => {
    expect(manifest.engines["node"]).toBe(baseline.runtime.node)
    expect(manifest.engines["pnpm"]).toBe(baseline.packageManagers["pnpm"])
    expect(manifest.packageManager).toBe(`pnpm@${baseline.packageManagers["pnpm"]}`)
    expect(read(".nvmrc").trim()).toBe(baseline.runtime.node)
  })

  it("pins the approved registry and denies install scripts by default", () => {
    const npmrc = read(".npmrc")

    expect(npmrc).toContain(`registry=${baseline.registries["javascript"]}/`)
    expect(npmrc).toContain("ignore-scripts=true")
    expect(npmrc).toContain("engine-strict=true")
  })

  it("keeps the reviewed build allowlist empty until a package earns an entry", () => {
    expect(read("pnpm-workspace.yaml")).toContain("onlyBuiltDependencies: []")
  })

  it("keeps the lockfile importer exactly consistent with the manifest", () => {
    const lockfile = read("pnpm-lock.yaml")
    const importers =
      lockfile.split("\nimporters:\n")[1]?.split("\npackages:\n")[0] ?? ""

    const specifiers: Record<string, string> = {}
    for (const match of importers.matchAll(
      /^ {6}'?([^'\n:]+)'?:\n {8}specifier: (.+)$/gm,
    )) {
      specifiers[match[1] as string] = (match[2] as string).trim()
    }

    // Exact equality, so the lockfile cannot carry an extra dependency the
    // manifest never declared, nor miss one the manifest requires.
    expect(specifiers).toEqual(declared)
  })

  it("pins every CI action to a full commit SHA recorded in the baseline", () => {
    const workflow = read(".github/workflows/ci.yml")
    const references = [...workflow.matchAll(/uses:\s*([^@\s]+)@([^\s#]+)/g)]

    expect(references.length).toBeGreaterThan(0)
    for (const [, action, reference] of references) {
      expect(reference).toMatch(/^[0-9a-f]{40}$/)
      expect(baseline.actions[action as string]?.commit).toBe(reference)
    }
  })

  it("keeps every formatter and linter away from digest-pinned bytes", () => {
    // A formatter run once rewrote the frozen EEM-9 plan and the generated
    // authority YAML. Those bytes may only change through a reviewed successor
    // pointer, so the exclusion is asserted rather than remembered.
    const prettierIgnore = read(".prettierignore")
    const oxlintConfig = readJson<{ ignorePatterns: string[] }>(".oxlintrc.json")

    for (const directory of ["docs/", "generated/", "vendor/"]) {
      expect(prettierIgnore).toContain(directory)
    }
    for (const pattern of ["generated/**", "vendor/**"]) {
      expect(oxlintConfig.ignorePatterns).toContain(pattern)
    }
  })

  it("produces no production source map and no debug surface", () => {
    const nextConfig = read("next.config.ts")

    expect(nextConfig).toContain("productionBrowserSourceMaps: false")
    expect(nextConfig).toContain("poweredByHeader: false")
    expect(nextConfig).toContain("ignoreBuildErrors: false")
  })
})
