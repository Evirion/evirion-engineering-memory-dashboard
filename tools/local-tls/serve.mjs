// Start the Console behind the local trusted edge for a browser gate.
//
// Generates TLS material if it is missing, builds and starts Next on
// loopback, then fronts it with the edge terminator on the pinned origin.
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { LOCAL_ORIGIN, generate, outputDirectory } from "./generate-certificate.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(here, "..", "..")
const upstreamPort = process.env.CONSOLE_UPSTREAM_PORT ?? "3000"

if (!existsSync(join(outputDirectory, "leaf.pem"))) {
  generate()
}

const children = []
const shutdown = (code) => {
  for (const child of children) child.kill("SIGTERM")
  process.exit(code)
}
process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

const run = (command, args, extraEnvironment = {}) => {
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
    env: { ...process.env, ...extraEnvironment },
  })
  children.push(child)
  child.on("exit", (code) => {
    if (code !== 0) shutdown(code ?? 1)
  })
  return child
}

const build = spawn("pnpm", ["build"], {
  cwd: repositoryRoot,
  stdio: "inherit",
  env: { ...process.env },
})

build.on("exit", (code) => {
  if (code !== 0) shutdown(code ?? 1)
  run("pnpm", [
    "exec",
    "next",
    "start",
    "--port",
    upstreamPort,
    "--hostname",
    "127.0.0.1",
  ])
  run("node", [join(here, "edge.mjs")], { CONSOLE_UPSTREAM_PORT: upstreamPort })
  console.log(`console will be reachable at ${LOCAL_ORIGIN}`)
})
