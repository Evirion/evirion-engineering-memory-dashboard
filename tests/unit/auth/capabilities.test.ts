import { describe, expect, it } from "vitest"

import type { SessionContext } from "@contracts/console"

import {
  NAVIGATION,
  hasCapability,
  roleLabel,
  visibleNavigation,
} from "@/lib/auth/capabilities"

const context = (overrides: Partial<SessionContext> = {}): SessionContext => ({
  actorId: "00000000-0000-4000-8000-000000000101",
  organizationId: "00000000-0000-4000-8000-000000000102",
  role: "reviewer",
  capabilities: ["knowledge.read"],
  ...overrides,
})

describe("four-role capability vocabulary", () => {
  it("labels exactly the four customer roles", () => {
    expect(roleLabel("owner")).toBe("Owner")
    expect(roleLabel("admin")).toBe("Admin")
    expect(roleLabel("reviewer")).toBe("Reviewer")
    expect(roleLabel("viewer")).toBe("Viewer")
  })

  it("never surfaces the database role name beside the customer term", () => {
    // Reviewer and `member` are one principal under two names. UI copy uses
    // one term, and it is the contract's external name.
    for (const role of ["owner", "admin", "reviewer", "viewer"] as const) {
      expect(roleLabel(role).toLowerCase()).not.toBe("member")
    }
  })
})

describe("navigation reflects capabilities and never grants them", () => {
  it("hides an entry whose capability the backend did not grant", () => {
    const reviewer = context({ capabilities: ["knowledge.read"] })
    const visible = visibleNavigation(reviewer).map((item) => item.href)

    expect(visible).toContain("/memory")
    expect(visible).not.toContain("/settings/members")
    expect(visible).not.toContain("/settings/github")
  })

  it("shows an entry once the backend grants its capability", () => {
    const owner = context({
      role: "owner",
      capabilities: [
        "organization.read",
        "knowledge.read",
        "processing.read",
        "organization.members.manage",
        "organization.github.manage",
        "organization.usage.read",
      ],
    })

    expect(visibleNavigation(owner).map((item) => item.href)).toEqual(
      NAVIGATION.map((item) => item.href),
    )
  })

  it("always offers the principal's own session inventory", () => {
    const viewer = context({ role: "viewer", capabilities: [] })

    // /settings/sessions is the principal's own inventory, not a member
    // roster, so it needs no organization capability.
    expect(visibleNavigation(viewer).map((item) => item.href)).toEqual([
      "/settings/sessions",
    ])
  })

  it("grants nothing from the role name alone", () => {
    // An Owner with an empty capability list sees no privileged entry: the
    // backend projection is the only authority, and the role is a label.
    const ownerWithoutCapabilities = context({ role: "owner", capabilities: [] })

    expect(
      visibleNavigation(ownerWithoutCapabilities).map((item) => item.href),
    ).toEqual(["/settings/sessions"])
    expect(hasCapability(ownerWithoutCapabilities, "organization.members.manage")).toBe(
      false,
    )
  })

  it("keeps every navigation target inside the frozen route contract", () => {
    const frozenPrefixes = [
      "/repositories",
      "/memory",
      "/processing",
      "/settings/members",
      "/settings/github",
      "/settings/usage",
      "/settings/sessions",
      "/onboarding",
    ]

    for (const item of NAVIGATION) {
      expect(
        frozenPrefixes.some((prefix) => item.href === prefix),
        `${item.href} is outside the reviewed route inventory`,
      ).toBe(true)
    }
  })
})
