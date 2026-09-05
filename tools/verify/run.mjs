// One stable gate entry point for every Console subtask.
//
// The slice registry is source-controlled in scripts/console_test_slices.json,
// so no task may leave "run focused tests" as an undocumented ad-hoc command.
// An unknown or empty slice fails rather than silently passing.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const registryPath = join(repositoryRoot, "scripts", "console_test_slices.json")

// `pnpm verify` is a local gate. CI runs its own explicit step list and never
// invokes this file, so the security stages below may depend on Docker and on a
// running backend without ever reaching a runner that has neither.
const FULL_GATE = [
  // First, because a stale listener would let every later stage assert against
  // a build nobody just made.
  ["pnpm", ["gate:ports"]],
  ["pnpm", ["lint"]],
  ["pnpm", ["format:check"]],
  ["pnpm", ["typecheck"]],
  ["pnpm", ["test:unit"]],
  ["pnpm", ["build"]],
  ["pnpm", ["test:e2e"]],
  ["pnpm", ["audit", "--audit-level", "high"]],
  ["pnpm", ["security:sast"]],
  ["pnpm", ["security:secrets"]],
  ["pnpm", ["security:supply-chain"]],
  ["pnpm", ["security:release-surface"]],
  ["pnpm", ["security:asvs"]],
  ["pnpm", ["security:dast:baseline"]],
]

const usage = () => {
  console.error("usage: run.mjs <focused|affected|full> [slice]")
  process.exit(2)
}

const run = (command, args) => {
  console.log(`\n> ${command} ${args.join(" ")}`)
  execFileSync(command, args, { cwd: repositoryRoot, stdio: "inherit" })
}

const [mode, ...rest] = process.argv.slice(2)
if (!mode) usage()

if (mode === "full") {
  for (const [command, args] of FULL_GATE) run(command, args)
  console.log("\ncomplete free gate passed")
  process.exit(0)
}

if (mode !== "focused" && mode !== "affected") usage()

// `pnpm verify:focused -- bootstrap` forwards a leading `--`.
const slice = rest.find((value) => value !== "--")
if (!slice) {
  console.error("a slice name is required; empty slices fail by contract")
  process.exit(2)
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"))
const entry = registry.slices[slice]
if (!entry) {
  console.error(
    `unknown slice "${slice}"; known slices: ${Object.keys(registry.slices).join(", ")}`,
  )
  process.exit(2)
}

const present = entry.testFiles.filter((path) => existsSync(join(repositoryRoot, path)))
if (present.length === 0) {
  console.error(`slice "${slice}" resolves to no existing test file`)
  process.exit(2)
}

const unitLike = present.filter(
  (path) => path.startsWith("tests/") && !path.endsWith(".spec.ts"),
)
const browserLike = present.filter((path) => path.endsWith(".spec.ts"))

run("pnpm", ["lint"])
run("pnpm", ["typecheck"])
if (unitLike.length > 0) run("pnpm", ["exec", "vitest", "run", ...unitLike])
if (browserLike.length > 0) run("pnpm", ["exec", "playwright", "test", ...browserLike])

if (mode === "affected") {
  run("pnpm", ["format:check"])
  run("pnpm", ["build"])
}

console.log(`\n${mode} gate passed for slice "${slice}"`)
