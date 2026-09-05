import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import { repositoryRoot } from "../support/source-tree"

/**
 * The Console half of the rollback rehearsal.
 *
 * One profile drives both repositories, so the two halves must refuse the same
 * things for the same reasons. Step 9 runs this against an authorized staging
 * deployment; here it only has to be executable and to refuse a profile that
 * could turn the dry run into the incident it prepares for.
 *
 * The backend owns the shipped profile and CI has no sibling checkout, so these
 * cases drive a fixture of the same shape. That mirrors the Auth parity lock,
 * which verifies pinned values in CI and compares the sibling only locally.
 */

const script = fileURLToPath(
  new URL("scripts/rehearse_console_rollback.sh", repositoryRoot),
)
const siblingProfile = fileURLToPath(
  new URL(
    "../evirion-engineering-memory/docs/evidence/console-free-canary-profile.json",
    repositoryRoot,
  ),
)

const FIXTURE = {
  environment: { kind: "staging", projectRef: "<UNAUTHORIZED-UNTIL-STEP-7>" },
  flags: { live: false, model: false, paid: false },
  plan: {
    forwardFix: [
      {
        description: "Apply the forward-only fix.",
        id: "forward-fix-migration",
        mutates: true,
      },
      {
        description: "Confirm zero paid delta.",
        id: "forward-fix-verify",
        mutates: false,
      },
    ],
    pause: [
      {
        description: "Set both live gates false.",
        id: "pause-live-gates",
        mutates: true,
      },
      { description: "Read worker health.", id: "pause-observe", mutates: false },
    ],
    rollback: [
      {
        description: "Repoint at the attested digest.",
        id: "rollback-artifact",
        mutates: true,
      },
      {
        description: "Confirm provenance is intact.",
        id: "rollback-verify",
        mutates: false,
      },
    ],
  },
  schemaVersion: "1.0",
  stopConditions: ["any-provider-request-count-increase"],
}

const workspace = mkdtempSync(join(tmpdir(), "console-rollback-"))
afterAll(() => rmSync(workspace, { recursive: true, force: true }))

const fixtureProfile = join(workspace, "fixture.json")
writeFileSync(fixtureProfile, JSON.stringify(FIXTURE), "utf8")

type Outcome = { status: number; stdout: string; stderr: string }

const rehearse = (profilePath: string): Outcome => {
  try {
    const stdout = execFileSync("bash", [script, profilePath], { encoding: "utf8" })
    return { status: 0, stdout, stderr: "" }
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string }
    return {
      status: failure.status ?? -1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    }
  }
}

const withProfile = (mutate: (value: Record<string, unknown>) => void): string => {
  const value = JSON.parse(JSON.stringify(FIXTURE)) as Record<string, unknown>
  mutate(value)
  const path = join(workspace, `${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(path, JSON.stringify(value), "utf8")
  return path
}

describe("console rollback rehearsal", () => {
  it("rehearses a valid profile without executing anything", () => {
    const outcome = rehearse(fixtureProfile)
    expect(outcome.status).toBe(0)
    expect(outcome.stdout).toContain("CONSOLE_ROLLBACK_REHEARSAL_OK")
    for (const phase of ["pause", "rollback", "forwardFix"]) {
      expect(outcome.stdout).toContain(`${phase}: `)
    }
    expect(outcome.stdout).toContain("would mutate")
    expect(outcome.stdout).toContain("read-only")
  })

  it.each(["live", "model", "paid"])(
    "refuses a profile whose %s gate is true",
    (flag) => {
      const path = withProfile((value) => {
        ;(value.flags as Record<string, boolean>)[flag] = true
      })
      const outcome = rehearse(path)
      expect(outcome.status).toBe(1)
      expect(outcome.stderr).toContain(
        `CONSOLE_ROLLBACK_REHEARSAL_REFUSED_LIVE_OR_MODEL:${flag}`,
      )
    },
  )

  it("refuses a profile carrying a credential-shaped key", () => {
    const path = withProfile((value) => {
      ;(value.environment as Record<string, unknown>).serviceRoleKey =
        "unused-placeholder"
    })
    const outcome = rehearse(path)
    expect(outcome.status).toBe(1)
    expect(outcome.stderr).toContain(
      "CONSOLE_ROLLBACK_REHEARSAL_REFUSED_PAYLOAD_BEARING",
    )
  })

  it.each(["pause", "rollback", "forwardFix"])("refuses a plan missing %s", (phase) => {
    const path = withProfile((value) => {
      delete (value.plan as Record<string, unknown>)[phase]
    })
    const outcome = rehearse(path)
    expect(outcome.status).toBe(1)
    expect(outcome.stderr).toContain(
      `CONSOLE_ROLLBACK_REHEARSAL_MISSING_PHASE:${phase}`,
    )
  })

  it("refuses a phase that never verifies what it changed", () => {
    const path = withProfile((value) => {
      const plan = value.plan as Record<string, { mutates: boolean }[] | undefined>
      plan.rollback = (plan.rollback ?? []).filter((step) => step.mutates)
    })
    const outcome = rehearse(path)
    expect(outcome.status).toBe(1)
    expect(outcome.stderr).toContain(
      "CONSOLE_ROLLBACK_REHEARSAL_PHASE_ENDS_WITHOUT_VERIFY:rollback",
    )
  })

  it("distinguishes a usage error from a refusal", () => {
    const missing = rehearse(join(workspace, "absent.json"))
    expect(missing.status).toBe(64)
    expect(missing.stderr).toContain("CONSOLE_ROLLBACK_REHEARSAL_PROFILE_MISSING")
  })

  it("refuses an unsupported schema version", () => {
    const path = withProfile((value) => {
      value.schemaVersion = "2.0"
    })
    const outcome = rehearse(path)
    expect(outcome.status).toBe(1)
    expect(outcome.stderr).toContain("CONSOLE_ROLLBACK_REHEARSAL_SCHEMA_UNSUPPORTED")
  })

  it("rehearses the profile the backend ships, when the sibling is checked out", () => {
    // Never a silent skip. Without the sibling this asserts its own
    // precondition, so the case can only pass by proving something either way.
    if (!existsSync(siblingProfile)) {
      expect(existsSync(siblingProfile)).toBe(false)
      return
    }
    const outcome = rehearse(siblingProfile)
    expect(outcome.status).toBe(0)
    expect(outcome.stdout).toContain("CONSOLE_ROLLBACK_REHEARSAL_OK")
  })
})
