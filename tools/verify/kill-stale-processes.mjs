// Clear the ports the browser gate owns before it starts.
//
// The EEM-9/04 acceptance trace records a stale process silently serving an old
// build: Playwright reuses an existing server outside CI, so a leftover
// next-server or console-stub answers the gate and every assertion runs against
// bytes nobody just built. That failure is quiet, which is what makes it
// dangerous, so the gate refuses to start until the ports are free.
import { execFileSync } from "node:child_process"

const OWNED_PORTS = [3000, 3443, 3444]

const listenersOn = (port) => {
  try {
    return execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
    })
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)
  } catch {
    // lsof exits non-zero when nothing is listening, which is the normal case.
    return []
  }
}

const terminate = (pid, signal) => {
  try {
    process.kill(Number(pid), signal)
    return true
  } catch {
    // Already gone between the lookup and the signal.
    return false
  }
}

let cleared = 0
for (const port of OWNED_PORTS) {
  for (const pid of listenersOn(port)) {
    process.stdout.write(`terminating stale listener ${pid} on port ${port}\n`)
    if (terminate(pid, "SIGTERM")) cleared += 1
  }
}

if (cleared > 0) {
  // SIGTERM is asynchronous; give the sockets a moment to actually close
  // before deciding the port is still held.
  const deadline = Date.now() + 5_000
  while (
    Date.now() < deadline &&
    OWNED_PORTS.some((port) => listenersOn(port).length > 0)
  ) {
    execFileSync("sleep", ["0.2"])
  }
  for (const port of OWNED_PORTS) {
    for (const pid of listenersOn(port)) terminate(pid, "SIGKILL")
  }
}

const remaining = OWNED_PORTS.flatMap((port) =>
  listenersOn(port).map((pid) => `${pid} on ${port}`),
)
if (remaining.length > 0) {
  console.error(`ports still held after SIGKILL: ${remaining.join(", ")}`)
  process.exit(1)
}

process.stdout.write(`gate ports clear; stale listeners cleared: ${cleared}\n`)
