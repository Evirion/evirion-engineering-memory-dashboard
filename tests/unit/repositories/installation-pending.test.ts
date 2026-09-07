import { describe, expect, it } from "vitest"

import {
  isInstallationPending,
  PENDING_PROOF_WINDOW_MS,
} from "@/components/repositories/github-connection"

const NOW = Date.parse("2026-09-07T12:00:00.000Z")

const at = (offsetMs: number): string => new Date(NOW - offsetMs).toISOString()

const summary = (
  intent: { status: string; resolvedAt: string | null } | null,
  installation: unknown = null,
) =>
  ({
    organizationId: "00000000-0000-4000-8000-000000000001",
    installation,
    setupIntent:
      intent === null
        ? null
        : {
            id: "00000000-0000-4000-8000-000000000002",
            status: intent.status,
            expiresAt: at(-900_000),
            resolvedAt: intent.resolvedAt,
            failureCode: null,
          },
    latestSyncRun: null,
    repositorySummary: { accessibleRepositories: 0, inaccessibleRepositories: 0 },
  }) as never

describe("waiting for the signed webhook proof", () => {
  it("is pending while a freshly consumed intent has no installation", () => {
    const view = summary({ status: "CONSUMED", resolvedAt: at(4_000) })

    expect(isInstallationPending(view, NOW)).toBe(true)
  })

  it("stops being pending once the proof window closes", () => {
    const view = summary({
      status: "CONSUMED",
      resolvedAt: at(PENDING_PROOF_WINDOW_MS + 1_000),
    })

    expect(isInstallationPending(view, NOW)).toBe(false)
  })

  it("is not pending for an organization that connected and then uninstalled", () => {
    // The projection reports no installation once the row is `removed`, while
    // the intent that connected it stays CONSUMED for good. Without the window
    // this shape is indistinguishable from waiting, and the page polls forever.
    const view = summary({ status: "CONSUMED", resolvedAt: at(30 * 24 * 3_600_000) })

    expect(isInstallationPending(view, NOW)).toBe(false)
  })

  it("is not pending while an installation is present", () => {
    const view = summary(
      { status: "CONSUMED", resolvedAt: at(4_000) },
      {
        id: "00000000-0000-4000-8000-000000000003",
        status: "ACTIVE",
        accountLogin: "acme",
        connectedAt: at(4_000),
      },
    )

    expect(isInstallationPending(view, NOW)).toBe(false)
  })

  it("is not pending for an intent that was never consumed", () => {
    expect(
      isInstallationPending(summary({ status: "CREATED", resolvedAt: null }), NOW),
    ).toBe(false)
    expect(isInstallationPending(summary(null), NOW)).toBe(false)
    expect(isInstallationPending(null, NOW)).toBe(false)
  })

  it("is not pending when the resolution instant is unreadable or ahead of now", () => {
    expect(
      isInstallationPending(
        summary({ status: "CONSUMED", resolvedAt: "not-a-time" }),
        NOW,
      ),
    ).toBe(false)
    expect(
      isInstallationPending(
        summary({ status: "CONSUMED", resolvedAt: at(-60_000) }),
        NOW,
      ),
    ).toBe(false)
  })
})
