import { describe, expect, it } from "vitest"

import {
  isSyncInProgress,
  isSyncStalled,
  SYNC_WATCH_WINDOW_MS,
} from "@/components/repositories/github-connection"

const NOW = Date.parse("2026-09-07T19:30:00.000Z")

const view = (run: { status: string; requestedAt?: string | null } | null) =>
  ({
    organizationId: "00000000-0000-4000-8000-000000000001",
    installation: {
      id: "00000000-0000-4000-8000-000000000002",
      status: "ACTIVE",
      accountLogin: "svg-dd",
      connectedAt: "2026-09-07T18:56:37.000000Z",
    },
    setupIntent: null,
    latestSyncRun:
      run === null
        ? null
        : {
            id: "00000000-0000-4000-8000-000000000003",
            status: run.status,
            generation: 1,
            version: 1,
            attemptCount: 0,
            progress: {
              pagesApplied: 0,
              repositoriesSeen: 0,
              repositoriesMarkedInaccessible: 0,
            },
            failureCode: null,
            requestedAt:
              run.requestedAt === undefined
                ? new Date(NOW - 5_000).toISOString()
                : run.requestedAt,
            startedAt: null,
            resolvedAt: null,
          },
    repositorySummary: { accessibleRepositories: 0, inaccessibleRepositories: 0 },
  }) as never

describe("watching a synchronization run", () => {
  it("watches a run that was requested moments ago", () => {
    for (const status of ["QUEUED", "RUNNING"]) {
      expect(isSyncInProgress(view({ status }), NOW)).toBe(true)
      expect(isSyncStalled(view({ status }), NOW)).toBe(false)
    }
  })

  it("stops watching once the window closes, and says so instead", () => {
    // A run reaches a terminal state only if something claims it. With no
    // executor deployed it stays QUEUED, and polling on status alone reloaded
    // the page every five seconds until the reader navigated away.
    const stale = {
      status: "QUEUED",
      requestedAt: new Date(NOW - SYNC_WATCH_WINDOW_MS - 1_000).toISOString(),
    }

    expect(isSyncInProgress(view(stale), NOW)).toBe(false)
    expect(isSyncStalled(view(stale), NOW)).toBe(true)
  })

  it("watches nothing once the run reaches a terminal state", () => {
    for (const status of ["COMPLETED", "FAILED", "UNSUPPORTED"]) {
      expect(isSyncInProgress(view({ status }), NOW)).toBe(false)
      expect(isSyncStalled(view({ status }), NOW)).toBe(false)
    }
  })

  it("watches nothing when no run exists", () => {
    expect(isSyncInProgress(view(null), NOW)).toBe(false)
    expect(isSyncStalled(view(null), NOW)).toBe(false)
    expect(isSyncInProgress(null, NOW)).toBe(false)
    expect(isSyncStalled(null, NOW)).toBe(false)
  })

  it("refuses an unreadable or future request instant rather than polling on it", () => {
    for (const requestedAt of [
      "not-a-time",
      null,
      new Date(NOW + 60_000).toISOString(),
    ]) {
      expect(isSyncInProgress(view({ status: "QUEUED", requestedAt }), NOW)).toBe(false)
    }
  })
})
