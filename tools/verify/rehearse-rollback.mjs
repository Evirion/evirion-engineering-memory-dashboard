// The Console rollback rehearsal, mirroring scripts/rehearse_console_rollback.sh
// in the backend so one profile drives both halves identically.
import { readFileSync } from "node:fs"

const REQUIRED_PHASES = ["pause", "rollback", "forwardFix"]
// A rehearsal must never carry material that would make the dry run itself a
// disclosure.
const FORBIDDEN_KEYS = new Set([
  "accessToken",
  "anonKey",
  "apiKey",
  "cookie",
  "dsn",
  "password",
  "privateKey",
  "refreshToken",
  "secret",
  "serviceRoleKey",
  "session",
  "token",
])

const fail = (code, status) => {
  console.error(code)
  process.exit(status)
}

const [, , profilePath] = process.argv
if (profilePath === undefined) fail("CONSOLE_ROLLBACK_REHEARSAL_USAGE", 64)

let profile
try {
  profile = JSON.parse(readFileSync(profilePath, "utf8"))
} catch {
  fail("CONSOLE_ROLLBACK_REHEARSAL_PROFILE_UNREADABLE", 64)
}

if (
  typeof profile !== "object" ||
  profile === null ||
  profile.schemaVersion !== "1.0"
) {
  fail("CONSOLE_ROLLBACK_REHEARSAL_SCHEMA_UNSUPPORTED", 1)
}

const walk = (node) => {
  if (Array.isArray(node)) return node.flatMap(walk)
  if (typeof node !== "object" || node === null) return []
  return Object.entries(node).flatMap(([key, value]) =>
    FORBIDDEN_KEYS.has(key) ? [key, ...walk(value)] : walk(value),
  )
}
const leaked = [...new Set(walk(profile))].toSorted()
if (leaked.length > 0) {
  fail(`CONSOLE_ROLLBACK_REHEARSAL_REFUSED_PAYLOAD_BEARING:${leaked.join(",")}`, 1)
}

const flags = profile.flags
if (typeof flags !== "object" || flags === null) {
  fail("CONSOLE_ROLLBACK_REHEARSAL_MISSING_FLAGS", 1)
}
for (const flag of ["live", "model", "paid"]) {
  if (flags[flag] !== false)
    fail(`CONSOLE_ROLLBACK_REHEARSAL_REFUSED_LIVE_OR_MODEL:${flag}`, 1)
}

const plan = profile.plan
if (typeof plan !== "object" || plan === null) {
  fail("CONSOLE_ROLLBACK_REHEARSAL_MISSING_PLAN", 1)
}

for (const phase of REQUIRED_PHASES) {
  const steps = plan[phase]
  if (!Array.isArray(steps) || steps.length === 0) {
    fail(`CONSOLE_ROLLBACK_REHEARSAL_MISSING_PHASE:${phase}`, 1)
  }
  for (const step of steps) {
    if (
      typeof step !== "object" ||
      step === null ||
      typeof step.id !== "string" ||
      step.id === "" ||
      typeof step.description !== "string" ||
      step.description === "" ||
      typeof step.mutates !== "boolean"
    ) {
      fail(`CONSOLE_ROLLBACK_REHEARSAL_MALFORMED_STEP:${phase}`, 1)
    }
    process.stdout.write(
      `${phase}: ${step.id} [${step.mutates ? "would mutate" : "read-only"}] ${step.description}\n`,
    )
  }
  // Every phase ends by observing, so an operator never leaves a rehearsal
  // believing an unverified change succeeded.
  if (steps.at(-1).mutates) {
    fail(`CONSOLE_ROLLBACK_REHEARSAL_PHASE_ENDS_WITHOUT_VERIFY:${phase}`, 1)
  }
}

if (!Array.isArray(profile.stopConditions) || profile.stopConditions.length === 0) {
  fail("CONSOLE_ROLLBACK_REHEARSAL_MISSING_STOP_CONDITIONS", 1)
}

process.stdout.write("CONSOLE_ROLLBACK_REHEARSAL_OK\n")
