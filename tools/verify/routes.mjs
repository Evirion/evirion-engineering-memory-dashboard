// Print every Console route in one view.
//
// Next.js has no route config file: the URLs are the shape of `src/app`. This
// resolves them the way Next does and shows them beside
// docs/architecture/console-route-inventory.json, which is the reviewed
// contract the route guard enforces.
//
// Reality and contract are printed together on purpose. A route that exists
// but is not in the registry, or the reverse, is the failure the guard exists
// to catch, and it should be visible here rather than only in a test.
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const appDirectory = join(repositoryRoot, "src", "app")

const PAGE_FILES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js"])
const ROUTE_HANDLER_FILES = new Set(["route.tsx", "route.ts", "route.jsx", "route.js"])

/** Resolve App Router segments to the URL Next.js actually serves. */
const resolveUrl = (segments) => {
  const parts = []
  for (const segment of segments) {
    if (segment.startsWith("(") && segment.endsWith(")")) continue
    if (segment.startsWith("_")) return null
    if (segment.startsWith("@")) return null
    if (segment.startsWith("[[") && segment.endsWith("]]")) {
      parts.push(`:${segment.slice(2, -2).replace(/^\.\.\./, "")}*`)
      continue
    }
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const inner = segment.slice(1, -1)
      parts.push(inner.startsWith("...") ? `:${inner.slice(3)}*` : `:${inner}`)
      continue
    }
    parts.push(segment)
  }
  return `/${parts.join("/")}`
}

const collect = (directory, segments = []) => {
  const found = []
  for (const entry of readdirSync(directory).toSorted()) {
    const child = join(directory, entry)
    if (statSync(child).isDirectory()) {
      found.push(...collect(child, [...segments, entry]))
      continue
    }
    const isPage = PAGE_FILES.has(entry)
    if (!isPage && !ROUTE_HANDLER_FILES.has(entry)) continue
    const url = resolveUrl(segments)
    if (url === null) continue
    found.push({
      url,
      kind: isPage ? "page" : "api",
      file: child.slice(repositoryRoot.length + 1),
    })
  }
  return found
}

const inventory = JSON.parse(
  readFileSync(
    join(repositoryRoot, "docs/architecture/console-route-inventory.json"),
    "utf8",
  ),
)

const matchesFrozen = (path) =>
  inventory.frozenPaths.some((entry) =>
    entry.endsWith("/*")
      ? path.startsWith(entry.slice(0, -1)) && path !== entry.slice(0, -2)
      : path === entry,
  )

const declared = new Map(inventory.declaredRoutes.map((entry) => [entry.path, entry]))
const routes = collect(appDirectory).toSorted(
  (left, right) =>
    left.kind.localeCompare(right.kind) || left.url.localeCompare(right.url),
)

const pad = (value, width) => value.padEnd(width)
const urlWidth = Math.max(...routes.map((route) => route.url.length), 34)

console.log("\nLIVE ROUTES — resolved from src/app exactly as Next.js serves them\n")
console.log(`${pad("URL", urlWidth)}  KIND  ORIGIN      FILE`)
console.log("-".repeat(urlWidth + 60))
for (const route of routes) {
  const origin =
    route.kind === "api"
      ? "bff"
      : matchesFrozen(route.url)
        ? "frozen"
        : declared.has(route.url)
          ? "declared"
          : "UNLISTED"
  console.log(
    `${pad(route.url, urlWidth)}  ${pad(route.kind, 4)}  ${pad(origin, 10)}  ${route.file}`,
  )
}

const live = new Set(
  routes.filter((route) => route.kind === "page").map((route) => route.url),
)
const pinned = inventory.present.map((entry) => entry.path)

console.log(
  "\nFROZEN CONTRACT — requirements Section 10, may not be renamed or added to\n",
)
for (const path of inventory.frozenPaths) {
  const built = [...live].some((url) =>
    path.endsWith("/*") ? url.startsWith(path.slice(0, -1)) : url === path,
  )
  console.log(`  ${built ? "built" : "  —  "}  ${path}`)
}

console.log("\nDECLARED OUTSIDE THE FREEZE — each needs an owner and a rationale\n")
for (const entry of inventory.declaredRoutes) {
  console.log(`  ${entry.path}  (${entry.owner})`)
}

const missing = pinned.filter((path) => !live.has(path))
const extra = [...live].filter((url) => !pinned.includes(url))
console.log(
  `\n${live.size} page routes live, ${pinned.length} pinned in the registry.` +
    (missing.length || extra.length
      ? `\nDRIFT — missing: ${missing.join(", ") || "none"}; unlisted: ${extra.join(", ") || "none"}`
      : "\nRegistry and filesystem agree.\n"),
)
