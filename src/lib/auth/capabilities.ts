import type { SessionContext } from "@contracts/console"

/**
 * Capability-driven navigation.
 *
 * Hiding a link is a convenience, never an authorization. The backend refuses
 * regardless, and every surface must still render the refusal path for a
 * control it also hides.
 *
 * The customer roles are Owner, Admin, Reviewer and Viewer. Reviewer is the
 * database role `member`; the contract already maps the two, and UI copy uses
 * one term only.
 */

export type ConsoleRole = SessionContext["role"]

export const ROLE_LABELS: Readonly<Record<ConsoleRole, string>> = {
  owner: "Owner",
  admin: "Admin",
  reviewer: "Reviewer",
  viewer: "Viewer",
}

export type NavigationItem = {
  readonly href: string
  readonly label: string
  /** Absent means every member may see the entry. */
  readonly capability?: string
}

export const NAVIGATION: readonly NavigationItem[] = [
  { href: "/repositories", label: "Repositories", capability: "organization.read" },
  { href: "/memory", label: "Memory", capability: "knowledge.read" },
  { href: "/processing", label: "Processing", capability: "processing.read" },
  {
    href: "/settings/members",
    label: "Members",
    capability: "organization.members.manage",
  },
  {
    href: "/settings/github",
    label: "GitHub",
    capability: "organization.github.manage",
  },
  { href: "/settings/usage", label: "Usage", capability: "organization.usage.read" },
  { href: "/settings/sessions", label: "Your sessions" },
]

export const hasCapability = (context: SessionContext, capability: string): boolean =>
  context.capabilities.includes(capability)

export const visibleNavigation = (context: SessionContext): readonly NavigationItem[] =>
  NAVIGATION.filter(
    (item) => item.capability === undefined || hasCapability(context, item.capability),
  )

export const roleLabel = (role: ConsoleRole): string => {
  switch (role) {
    case "owner":
      return ROLE_LABELS.owner
    case "admin":
      return ROLE_LABELS.admin
    case "reviewer":
      return ROLE_LABELS.reviewer
    case "viewer":
      return ROLE_LABELS.viewer
    default: {
      const exhaustive: never = role
      throw new Error(`unhandled role: ${String(exhaustive)}`)
    }
  }
}
