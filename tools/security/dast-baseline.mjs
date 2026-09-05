// Baseline DAST against the pinned loopback HTTPS origin.
//
// This is the free half of SEC-WEB-012. It scans the public and Auth boundary
// of a real production build with no customer data, no authenticated session
// and no staging deployment. The authenticated scan is Step 7 work and needs a
// separate authorization; nothing here reaches a remote host.
//
// ZAP is pulled by digest from tools/security/toolchain.lock, never by tag, so
// a moved `stable` tag cannot silently change what scanned the build.
import { execFileSync, spawn } from "node:child_process"
import { request as httpsRequest } from "node:https"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const lock = JSON.parse(
  readFileSync(join(repositoryRoot, "tools/security/toolchain.lock"), "utf8"),
)

const HOSTNAME = "console.evirion.test"
const EDGE_PORT = 3443
const UPSTREAM_PORT = 3000
const TARGET = `https://${HOSTNAME}:${EDGE_PORT}`
// ZAP risk codes: 0 informational, 1 low, 2 medium, 3 high. High is its top
// severity, so this is the Critical/High gate the plan asks for.
const BLOCKING_RISK_CODE = 3

const requireOrFail = (condition, message) => {
  if (!condition) finish(1, message)
}

requireOrFail(
  typeof lock?.tools?.zap?.digest === "string" &&
    lock.tools.zap.digest.startsWith("sha256:"),
  "tools/security/toolchain.lock does not pin a ZAP image digest",
)
const image = `${lock.tools.zap.image}@${lock.tools.zap.digest}`

const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", cwd: repositoryRoot, ...options })

const started = []

/**
 * Detached, so each child leads its own process group.
 *
 * `serve.mjs` spawns Next itself, so signalling only the child we know about
 * would orphan a server still holding the upstream port. Signalling the group
 * reaches both. The children are also unref'd: otherwise they hold this
 * process's event loop open and the runner never exits after a passing scan,
 * which is exactly how the first version of this file hung.
 */
const startBackground = (command, args, env) => {
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env, ...env },
    stdio: "ignore",
    detached: true,
  })
  child.unref()
  started.push(child)
  return child
}

const stopEverything = () => {
  for (const child of started) {
    if (child.pid === undefined) continue
    try {
      process.kill(-child.pid, "SIGTERM")
    } catch {
      // The group is already gone.
    }
  }
}

const finish = (code, message) => {
  if (message) console.error(message)
  stopEverything()
  process.exit(code)
}

process.on("SIGINT", () => finish(130))
process.on("SIGTERM", () => finish(143))

const waitFor = async (probe, timeoutMilliseconds, description) => {
  const deadline = Date.now() + timeoutMilliseconds
  while (Date.now() < deadline) {
    // Polling is sequential by definition: the next probe only makes sense
    // after the previous one said no. Running them together would hammer a
    // server that is still starting.
    // oxlint-disable-next-line no-await-in-loop
    if (await probe()) return
    // oxlint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  finish(1, `timed out waiting for ${description}`)
}

const reportDirectory = mkdtempSync(join(tmpdir(), "eem-dast-"))

try {
  run("docker", ["version", "--format", "{{.Server.Version}}"], { stdio: "ignore" })
} catch {
  finish(1, "Docker is required for the digest-pinned baseline DAST and is not running")
}

console.log(`pulling ${image}`)
run("docker", ["pull", "--quiet", image])

// The production build is the subject: a development server would answer with
// different headers, different caching and a source map the release never has.
// serve.mjs builds, starts Next and fronts it with the trusted-proxy edge, so
// starting Next separately would only fight it for the upstream port.
console.log("building and starting the production build behind the local edge")
startBackground("node", ["tools/local-tls/serve.mjs"], {
  // ZAP runs in a container and cannot reach the host's loopback, so the edge
  // binds to every interface for the length of this scan only. Nothing else
  // sets this, and the default stays loopback.
  CONSOLE_EDGE_BIND_ADDRESS: "0.0.0.0",
  NODE_EXTRA_CA_CERTS: join(repositoryRoot, "tools/local-tls/.local/authority.pem"),
  CONSOLE_CANONICAL_ORIGIN: TARGET,
  CONSOLE_TRUSTED_PROXY_HOPS: "1",
  CONSOLE_UPSTREAM_PORT: String(UPSTREAM_PORT),
  SUPABASE_URL: "https://project.supabase.test",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture",
  CONSOLE_API_BASE_URL: "https://127.0.0.1:3444",
  CONSOLE_GITHUB_APP_INSTALL_URL:
    "https://github.com/apps/evirion-local/installations/new",
  CONSOLE_CSRF_SIGNING_KEY: "console-local-test-csrf-signing-key-0001",
  CONSOLE_BFF_PROOF_SIGNING_KEY: "console-local-test-proof-signing-key-001",
})

/**
 * Readiness only. The probe runs in Node, where the local leaf is not in the
 * trust store, so it does not verify the certificate — exactly as the Playwright
 * readiness probe does not, and for the same reason. It proves the origin
 * answers; ZAP then performs the scan that actually matters.
 */
const originAnswers = () =>
  new Promise((resolve) => {
    const request = httpsRequest(
      {
        host: "127.0.0.1",
        port: EDGE_PORT,
        path: "/",
        method: "GET",
        rejectUnauthorized: false,
        servername: HOSTNAME,
        timeout: 5_000,
      },
      (response) => {
        response.resume()
        resolve(Number(response.statusCode) > 0)
      },
    )
    request.on("error", () => resolve(false))
    request.on("timeout", () => {
      request.destroy()
      resolve(false)
    })
    request.end()
  })

await waitFor(
  originAnswers,
  300_000,
  "the production build on the pinned loopback origin",
)
console.log(`serving ${TARGET}`)

// `-I` stops ZAP failing the process on warnings; this runner decides what
// blocks by reading the report, so the threshold lives in one place.
let scanFailed = false
try {
  run("docker", [
    "run",
    "--rm",
    `--add-host=${HOSTNAME}:host-gateway`,
    "-v",
    `${reportDirectory}:/zap/wrk:rw`,
    image,
    "zap-baseline.py",
    "-t",
    TARGET,
    "-J",
    "report.json",
    "-I",
  ])
} catch {
  scanFailed = true
}

let report
try {
  report = JSON.parse(readFileSync(join(reportDirectory, "report.json"), "utf8"))
} catch {
  rmSync(reportDirectory, { recursive: true, force: true })
  finish(1, "ZAP produced no readable report; treating the scan as failed")
}

const blocking = []
for (const site of report.site ?? []) {
  for (const alert of site.alerts ?? []) {
    if (Number(alert.riskcode) >= BLOCKING_RISK_CODE) {
      blocking.push(
        `${alert.riskdesc}: ${alert.name} (${alert.instances?.length ?? 0} instances)`,
      )
    }
  }
}

const alertCount = (report.site ?? []).reduce(
  (total, site) => total + (site.alerts?.length ?? 0),
  0,
)
console.log(
  `baseline DAST finished: ${alertCount} alerts, ${blocking.length} at High or above`,
)
rmSync(reportDirectory, { recursive: true, force: true })

if (blocking.length > 0) {
  console.error("blocking alerts:")
  for (const entry of blocking) console.error(`  ${entry}`)
  finish(1)
}
if (scanFailed) {
  finish(
    1,
    "ZAP exited non-zero with no High alert; investigate before accepting the run",
  )
}
console.log("baseline DAST passed with no High or above alert")
finish(0)
