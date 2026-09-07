import { describe, expect, it } from "vitest"

import { assignableRoles, roleControl } from "@/components/settings/members-panel"

/**
 * `api.update_organization_membership` lets an owner re-role anyone but an
 * owner, and lets an admin re-role only a reviewer or a viewer, and only into
 * one of those. The panel offered the control to every non-owner row, so an
 * admin was shown a picker for their own row and for other admins — actions the
 * backend answers `CAPABILITY_REQUIRED`. Nothing was at risk; the reader was
 * invited to do something impossible, which is the defect.
 */

const member = (role: "owner" | "admin" | "reviewer" | "viewer") =>
  ({
    createdAt: "2026-09-07T00:00:00.000000Z",
    disabledAt: null,
    email: "member@example.test",
    id: "00000000-0000-4000-8000-000000000001",
    role,
    status: "ACTIVE",
    userId: "00000000-0000-4000-8000-000000000002",
    version: 1,
  }) as const

describe("who may be re-roled from the members panel", () => {
  it("never offers the owner's own row to anyone", () => {
    for (const actor of ["owner", "admin"] as const) {
      expect(roleControl(actor, member("owner"))).toBe("owner-fixed")
    }
  })

  it("lets an owner re-role an admin, a reviewer and a viewer", () => {
    for (const role of ["admin", "reviewer", "viewer"] as const) {
      expect(roleControl("owner", member(role))).toBe("editable")
    }
  })

  it("does not let an admin re-role another admin, or themselves", () => {
    // An admin's own row carries the admin role, so the general rule covers the
    // self case without a special one: the picker simply is not offered.
    expect(roleControl("admin", member("admin"))).toBe("owner-only")
  })

  it("lets an admin re-role a reviewer and a viewer", () => {
    for (const role of ["reviewer", "viewer"] as const) {
      expect(roleControl("admin", member(role))).toBe("editable")
    }
  })
})

describe("what may be assigned", () => {
  it("offers an owner every role the backend accepts", () => {
    expect(assignableRoles("owner").map((option) => option.value)).toEqual([
      "admin",
      "reviewer",
      "viewer",
    ])
  })

  it("never offers an admin the ability to mint another admin", () => {
    expect(assignableRoles("admin").map((option) => option.value)).toEqual([
      "reviewer",
      "viewer",
    ])
  })
})
