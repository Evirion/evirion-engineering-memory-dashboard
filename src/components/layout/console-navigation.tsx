import type { SessionContext } from "@contracts/console"
import {
  Activity,
  ChartNoAxesColumn,
  FolderGit2,
  Layers,
  Link2,
  LogOut,
  Menu,
  MonitorSmartphone,
  Users,
} from "lucide-react"

import {
  roleLabel,
  visibleNavigationSections,
  type NavigationGroup,
  type NavigationIcon,
} from "@/lib/auth/capabilities"
import { buttonVariants } from "@/components/ui/button"
import { Kicker } from "@/components/ui/text"
import { OrganizationSwitcher } from "./organization-switcher"

/**
 * Navigation reflects backend capabilities. A hidden entry is a convenience:
 * reaching the same route directly is still refused by the backend, and the
 * refusal path is rendered rather than assumed unreachable.
 */

const NavIcon = ({ icon, className }: { icon: NavigationIcon; className: string }) => {
  switch (icon) {
    case "repositories":
      return <FolderGit2 aria-hidden className={className} strokeWidth={1.5} />
    // The Brand Book's own device for accumulated context, section 18.2.
    case "memory":
      return <Layers aria-hidden className={className} strokeWidth={1.5} />
    case "processing":
      return <Activity aria-hidden className={className} strokeWidth={1.5} />
    case "members":
      return <Users aria-hidden className={className} strokeWidth={1.5} />
    case "github":
      return <Link2 aria-hidden className={className} strokeWidth={1.5} />
    case "usage":
      return <ChartNoAxesColumn aria-hidden className={className} strokeWidth={1.5} />
    case "sessions":
      return <MonitorSmartphone aria-hidden className={className} strokeWidth={1.5} />
    default: {
      const exhaustive: never = icon
      throw new Error(`unhandled navigation icon: ${String(exhaustive)}`)
    }
  }
}

/**
 * The link list, shared by the sidebar and the small-viewport disclosure.
 *
 * Both are in the document but each is `display: none` at the other's width,
 * which removes it from the accessibility tree, so exactly one navigation
 * landmark is ever exposed.
 */
const NavigationGroups = ({ groups }: { groups: readonly NavigationGroup[] }) => (
  <div className="flex flex-col gap-6">
    {groups.map((group) => (
      <div key={group.section} className="flex flex-col gap-0.5">
        <Kicker className="px-3 pb-1">{group.label}</Kicker>
        {group.items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="text-ink-secondary hover:bg-sidebar-accent hover:text-sidebar-accent-foreground tactile flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <NavIcon icon={item.icon} className="size-4 shrink-0 opacity-70" />
            {item.label}
          </a>
        ))}
      </div>
    ))}
  </div>
)

const BrandMark = () => (
  <span className="text-foreground flex items-center gap-2 text-sm font-semibold tracking-tight">
    {/*
      Three stacked layers: the Brand Book's memory-layers device. It is the
      one decorative mark in the Console, and it carries the idea the product
      is named for rather than ornamenting the corner.
    */}
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="text-primary size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <path d="M8 2.5 14 5.5 8 8.5 2 5.5z" />
      <path d="M2 8.5 8 11.5 14 8.5" />
      <path d="M2 11.5 8 14.5 14 11.5" />
    </svg>
    Engineering Memory
  </span>
)

export const ConsoleSidebar = ({ context }: { context: SessionContext }) => (
  <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh flex-col gap-6 border-r p-4 lg:flex">
    <div className="px-3 py-2">
      <BrandMark />
    </div>
    <nav aria-label="Console" className="flex-1 overflow-y-auto">
      <NavigationGroups groups={visibleNavigationSections(context)} />
    </nav>
    <div className="border-sidebar-border flex flex-col gap-0.5 border-t px-3 pt-4">
      <Kicker>Role</Kicker>
      <span className="text-ink-secondary text-sm font-medium">
        {roleLabel(context.role)}
      </span>
    </div>
  </aside>
)

/**
 * The one transparent surface in the Console.
 *
 * Glass is functional here rather than ornamental: content visibly scrolls
 * beneath the bar, so the reader never loses their place in a long queue. The
 * 1px inner highlight is what makes it read as a physical edge instead of a
 * washed-out rectangle. Every other surface in the product is opaque, which
 * is what keeps this one legible as a signal.
 */
export const ConsoleBar = ({
  context,
  csrfToken,
}: {
  context: SessionContext
  csrfToken: string
}) => (
  <header className="border-border bg-glass inset-shadow-glass sticky top-0 z-20 border-b backdrop-blur-xl">
    <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-10">
      <div className="lg:hidden">
        <BrandMark />
      </div>

      {/*
        The organization is stated in the bar because it is the one fact a
        person must confirm before acting, and the contract publishes no
        display name for it — only the identifier the switcher renders. The
        eyebrow is what tells the reader which question the value answers.
      */}
      <div className="flex flex-1 flex-col">
        <Kicker>Organization</Kicker>
        <OrganizationSwitcher
          organizationId={context.organizationId}
          csrfToken={csrfToken}
        />
      </div>

      <span className="bg-muted text-ink-secondary hidden rounded-sm px-2 py-1 text-xs font-medium lg:inline">
        {roleLabel(context.role)}
      </span>

      <form action="/api/auth/logout" method="post">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <button
          type="submit"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <LogOut aria-hidden strokeWidth={1.5} />
          Sign out
        </button>
      </form>
    </div>

    {/*
      The small-viewport navigation. A native disclosure rather than a
      scripted drawer: this Console serves no `unsafe-inline` style, so a
      control needing neither JavaScript nor a style attribute is the one that
      actually works here.
    */}
    <details className="border-border border-t lg:hidden">
      <summary
        className={`${buttonVariants({ variant: "ghost", size: "sm" })} m-2 w-[calc(100%-1rem)] cursor-pointer list-none justify-start [&::-webkit-details-marker]:hidden`}
      >
        <Menu aria-hidden strokeWidth={1.5} />
        Menu
      </summary>
      <nav aria-label="Console" className="px-2 pb-4">
        <NavigationGroups groups={visibleNavigationSections(context)} />
      </nav>
    </details>
  </header>
)
