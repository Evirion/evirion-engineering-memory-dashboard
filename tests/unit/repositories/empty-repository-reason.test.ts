import { describe, expect, it } from "vitest"

import { emptyRepositoryReason } from "@/components/repositories/repository-list"

const connected = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "ACTIVE",
  accountLogin: "svg-dd",
  connectedAt: "2026-09-07T18:56:37.000000Z",
}

const view = (installation: unknown, latestSyncRun: { status: string } | null = null) =>
  ({
    organizationId: "00000000-0000-4000-8000-000000000002",
    installation,
    setupIntent: null,
    latestSyncRun,
    repositorySummary: { accessibleRepositories: 0, inaccessibleRepositories: 0 },
  }) as never

describe("why the repository inventory is empty", () => {
  it("asks an unconnected organization to connect", () => {
    for (const empty of [null, view(null)]) {
      expect(emptyRepositoryReason(empty)).toMatch(/Connect the GitHub App/)
    }
  })

  it("asks a freshly connected organization to synchronize, not to connect again", () => {
    const reason = emptyRepositoryReason(view(connected))

    expect(reason).toMatch(/Synchronize/)
    // The whole point: a reader who just connected must not be told to connect.
    expect(reason).not.toMatch(/Connect the GitHub App/)
  })

  it("says a run is under way rather than asking for another", () => {
    for (const status of ["QUEUED", "RUNNING"]) {
      const reason = emptyRepositoryReason(view(connected, { status }))

      expect(reason).toMatch(/Reading which repositories/)
      expect(reason).not.toMatch(/Synchronize again/)
    }
  })

  it("asks for another run after one that did not finish", () => {
    expect(emptyRepositoryReason(view(connected, { status: "FAILED" }))).toMatch(
      /did not finish.*Synchronize again/s,
    )
  })

  it("points at GitHub access once a run completed and still found nothing", () => {
    const reason = emptyRepositoryReason(view(connected, { status: "COMPLETED" }))

    expect(reason).toMatch(/can see no repository/)
    expect(reason).toMatch(/Adjust which repositories/)
  })

  it("fails closed on a run state the Console does not publish", () => {
    expect(emptyRepositoryReason(view(connected, { status: "UNSUPPORTED" }))).toMatch(
      /does not recognize/,
    )
  })
})
