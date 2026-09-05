import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { repositoryRoot } from "../support/source-tree"

/**
 * The ASVS matrix must point at something that runs.
 *
 * Before EEM-9/07 every row named a synthesised case such as `asvs_v6_1_1` that
 * existed in no suite, and the Python ones could never be pytest nodes at all.
 * That, not neglect, is why all 212 rows had always read `planned`: no row's
 * evidence had ever pointed at anything.
 */

const read = (relative: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8"))

const matrix = read("docs/security/asvs-v5.0.0-l2-console-evidence.yaml") as {
  rowCount: number
  rows: { id: string; primaryEvidence: string; primaryOwner: string; status: string }[]
}
const statusSource = read("docs/security/asvs-status.json") as {
  evidenceKind: string
  rows: Record<string, { status: string; verifiedBy: string; observedAt: string }>
}

describe("ASVS evidence resolves", () => {
  it("names a file rather than a case that cannot exist", () => {
    for (const row of matrix.rows) {
      expect(row.primaryEvidence, `${row.id} still names a case`).not.toContain("::")
    }
  })

  it("points every Console-owned row at a file in this repository", () => {
    const missing = matrix.rows
      .filter((row) => !row.primaryEvidence.endsWith(".py"))
      .filter(
        (row) =>
          !existsSync(fileURLToPath(new URL(row.primaryEvidence, repositoryRoot))),
      )
      .map((row) => `${row.id} -> ${row.primaryEvidence}`)
    expect(missing).toEqual([])
  })

  it("leaves the backend-owned rows naming a backend suite", () => {
    const backend = matrix.rows.filter((row) => row.primaryEvidence.endsWith(".py"))
    expect(backend.length).toBeGreaterThan(0)
    for (const row of backend) expect(row.primaryOwner).toBe("I01-B")
  })
})

describe("ASVS status is recorded, never assumed", () => {
  it("gives every row that is not planned a command and a date", () => {
    for (const row of matrix.rows) {
      if (row.status === "planned") continue
      const recorded = statusSource.rows[row.id]
      expect(recorded, `${row.id} is ${row.status} with nothing recorded`).toBeDefined()
      expect(recorded?.status).toBe(row.status)
      expect(recorded?.verifiedBy ?? "").not.toBe("")
      expect(recorded?.observedAt ?? "").toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it("says plainly that the evidence is suite level", () => {
    // A reader must not mistake this for a separate assertion per requirement.
    expect(statusSource.evidenceKind).toBe("suite-level")
  })

  it("cannot let a row pass by being left out", () => {
    const recorded = new Set(Object.keys(statusSource.rows))
    const passing = matrix.rows
      .filter((row) => row.status !== "planned")
      .map((row) => row.id)
    for (const id of passing) expect(recorded.has(id)).toBe(true)
  })
})
