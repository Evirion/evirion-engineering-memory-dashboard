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

/**
 * The three questions the navigation answers, in the order a reader asks
 * them: what am I working on, how is the organization set up, and what is
 * true of my own account.
 *
 * Grouping is not decoration. Seven flat entries in one strip made
 * `Repositories` and `Your sessions` look like peers when one is the daily
 * surface and the other is visited twice a year.
 */
export type NavigationSection = "work" | "organization" | "you"

/**
 * Named rather than imported as a component, so this module stays free of
 * React and the icon set can be swapped without touching the capability
 * model. `src/components/layout/console-navigation.tsx` resolves each name
 * through an exhaustive switch, so an entry added here without an icon fails
 * the build instead of rendering a blank square.
 */
export type NavigationIcon =
  "repositories" | "memory" | "processing" | "members" | "github" | "usage" | "sessions"

export type NavigationItem = {
  readonly href: string
  readonly label: string
  readonly section: NavigationSection
  readonly icon: NavigationIcon
  /** Absent means every member may see the entry. */
  readonly capability?: string
}

export const NAVIGATION: readonly NavigationItem[] = [
  {
    href: "/repositories",
    label: "Repositories",
    section: "work",
    icon: "repositories",
    capability: "organization.read",
  },
  {
    href: "/memory",
    label: "Memory",
    section: "work",
    icon: "memory",
    capability: "knowledge.read",
  },
  {
    href: "/processing",
    label: "Processing",
    section: "work",
    icon: "processing",
    capability: "processing.read",
  },
  {
    href: "/settings/members",
    label: "Members",
    section: "organization",
    icon: "members",
    capability: "organization.members.manage",
  },
  {
    href: "/settings/github",
    label: "GitHub",
    section: "organization",
    icon: "github",
    capability: "organization.github.manage",
  },
  {
    href: "/settings/usage",
    label: "Usage",
    section: "organization",
    icon: "usage",
    capability: "organization.usage.read",
  },
  {
    href: "/settings/sessions",
    label: "Your sessions",
    section: "you",
    icon: "sessions",
  },
]

export const hasCapability = (context: SessionContext, capability: string): boolean =>
  context.capabilities.includes(capability)

export const visibleNavigation = (context: SessionContext): readonly NavigationItem[] =>
  NAVIGATION.filter(
    (item) => item.capability === undefined || hasCapability(context, item.capability),
  )

export const navigationSectionLabel = (section: NavigationSection): string => {
  switch (section) {
    case "work":
      return "Work"
    case "organization":
      return "Organization"
    case "you":
      return "You"
    default: {
      const exhaustive: never = section
      throw new Error(`unhandled navigation section: ${String(exhaustive)}`)
    }
  }
}

export type NavigationGroup = {
  readonly section: NavigationSection
  readonly label: string
  readonly items: readonly NavigationItem[]
}

const SECTION_ORDER: readonly NavigationSection[] = ["work", "organization", "you"]

/**
 * The visible entries, grouped and in order.
 *
 * A section every entry of which is hidden by capability is dropped rather
 * than rendered as an empty heading, so a Viewer does not see an
 * `Organization` label with nothing under it.
 */
export const visibleNavigationSections = (
  context: SessionContext,
): readonly NavigationGroup[] => {
  const visible = visibleNavigation(context)

  return SECTION_ORDER.map((section) => ({
    section,
    label: navigationSectionLabel(section),
    items: visible.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0)
}

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
