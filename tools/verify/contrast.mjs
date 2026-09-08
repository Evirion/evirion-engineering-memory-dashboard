// Measure every colour pair the Console actually ships.
//
// AGENTS.md fixes WCAG 2.2 AA as the target for every owned journey, and three
// Brand Book hues sit below the 4.5:1 body-text threshold on a light surface.
// Mineral Grey, Warning and Verified therefore each have a text-only relative
// derived at constant hue. Those derivations are only trustworthy while
// something re-measures them, so this reads the shipped `src/app/globals.css`
// rather than a table copied out of it: a token edited in the stylesheet is
// re-checked here, and a token that exists only here fails as unknown.
//
// Three classes of assertion, because legibility and hierarchy are different
// problems and only the first has a published threshold:
//
//   text       4.5:1, SC 1.4.3
//   non-text   3:1,   SC 1.4.11 — focus ring, control and chip boundaries
//   step       a ladder rung must be *distinguishable* from the one above it,
//              not merely legible against the background
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const stylesheet = readFileSync(join(repositoryRoot, "src/app/globals.css"), "utf8")

/** Pull one top-level block's custom properties out of the stylesheet. */
const readBlock = (selector) => {
  const start = stylesheet.indexOf(`\n${selector} {`)
  if (start === -1) throw new Error(`no ${selector} block in globals.css`)
  const body = stylesheet.slice(start + selector.length + 3)
  const end = body.indexOf("\n}")
  if (end === -1) throw new Error(`unterminated ${selector} block`)

  const declarations = new Map()
  for (const [, name, value] of body
    .slice(0, end)
    .matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    declarations.set(name, value.trim())
  }
  return declarations
}

// The Console renders light only; globals.css records why there is no `.dark`.
const root = readBlock(":root")

/**
 * Resolve `var(--a)` chains down to the literal hex they bottom out in. Token
 * names are written bare in the pair table below and with the `--` prefix in
 * the stylesheet, so both spellings resolve to the same declaration.
 */
const resolve = (declarations, name, seen = new Set()) => {
  const property = name.startsWith("--") ? name : `--${name}`
  if (seen.has(property)) throw new Error(`circular custom property: ${property}`)
  const value = declarations.get(property)
  if (value === undefined) throw new Error(`unknown custom property: ${property}`)

  const reference = /^var\((--[\w-]+)\)$/.exec(value)
  return reference === null
    ? value
    : resolve(declarations, reference[1], new Set([...seen, property]))
}

const channels = (hex) => {
  const value = hex.trim().toLowerCase()
  const expanded =
    value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value
  if (!/^#[0-9a-f]{6}$/.test(expanded)) throw new Error(`not an opaque hex: ${hex}`)
  return [1, 3, 5].map((offset) =>
    Number.parseInt(expanded.slice(offset, offset + 2), 16),
  )
}

// WCAG 2.x relative luminance, sRGB.
const luminance = (hex) => {
  const [red, green, blue] = channels(hex).map((raw) => {
    const channel = raw / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const ratio = (foreground, background) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].toSorted(
    (left, right) => right - left,
  )
  return (lighter + 0.05) / (darker + 0.05)
}

const TONES = [
  "verified",
  "attention",
  "rejected",
  "progress",
  "holding",
  "neutral",
  "unknown",
]

/** Every pair, as [foreground, background, threshold, what it is]. */
const pairs = () => {
  const checks = [
    ["foreground", "background", 4.5, "heading on canvas"],
    ["foreground", "card", 4.5, "heading on panel"],
    ["ink-secondary", "background", 4.5, "prose on canvas"],
    ["ink-secondary", "card", 4.5, "prose on panel"],
    ["muted-foreground", "background", 4.5, "metadata on canvas"],
    ["muted-foreground", "card", 4.5, "metadata on panel"],
    ["muted-foreground", "muted", 4.5, "metadata in a well"],
    ["primary", "background", 4.5, "link on canvas"],
    ["primary", "card", 4.5, "link on panel"],
    ["primary-foreground", "primary", 4.5, "primary button label"],
    ["primary-foreground", "primary-hover", 4.5, "primary button label, hovered"],
    ["primary-foreground", "primary-active", 4.5, "primary button label, pressed"],
    ["secondary-foreground", "secondary", 4.5, "secondary button label"],
    ["secondary-foreground", "secondary-hover", 4.5, "secondary button label, hovered"],
    ["accent-foreground", "accent", 4.5, "accent label"],
    ["destructive", "background", 4.5, "danger text on canvas"],
    ["destructive", "card", 4.5, "danger text on panel"],
    ["destructive-foreground", "destructive", 4.5, "danger button label"],
    [
      "destructive-foreground",
      "destructive-hover",
      4.5,
      "danger button label, hovered",
    ],
    ["ink-inverse", "surface-inverse", 4.5, "text on the inverse surface"],
    ["sidebar-foreground", "sidebar", 4.5, "sidebar link"],
    ["sidebar-accent-foreground", "sidebar-accent", 4.5, "sidebar active link"],
    ["sidebar-primary-foreground", "sidebar-primary", 4.5, "sidebar primary label"],

    ["ring", "background", 3, "focus ring on canvas"],
    ["ring", "card", 3, "focus ring on panel"],
    ["input", "card", 3, "control border on panel"],
    ["line-strong", "card", 3, "emphasised rule on panel"],
  ]

  for (const tone of TONES) {
    checks.push(
      [`tone-${tone}-text`, `tone-${tone}-fill`, 4.5, `${tone} chip label`],
      [`tone-${tone}-icon`, `tone-${tone}-fill`, 3, `${tone} chip glyph`],
      [`tone-${tone}-border`, "card", 3, `${tone} chip edge on panel`],
      // A notice reuses the chip fill at panel size and carries prose and
      // mono metadata on it, so the two body greys are measured there too.
      [`ink-secondary`, `tone-${tone}-fill`, 4.5, `prose on a ${tone} notice`],
      [`muted-foreground`, `tone-${tone}-fill`, 4.5, `metadata on a ${tone} notice`],
    )
  }
  return checks
}

/*
 * Hierarchy, not legibility. The first cut of this palette had prose and
 * metadata sharing a grey: every pair passed AA and the page still read as one
 * flat colour, because a rung that is legible against the background can still
 * be indistinguishable from the rung above it.
 */
const steps = [
  ["foreground", "ink-secondary", 1.6, "heading against prose"],
  ["ink-secondary", "muted-foreground", 1.4, "prose against metadata"],
  ["card", "background", 1.04, "panel against canvas"],
  ["background", "muted", 1.03, "canvas against a well"],
]

const failures = []
const rows = []

for (const [foreground, background, threshold, what] of pairs()) {
  const measured = ratio(resolve(root, foreground), resolve(root, background))
  const passed = measured >= threshold
  rows.push([what, `${foreground} on ${background}`, measured, threshold, passed])
  if (!passed) {
    failures.push(
      `${what} — ${foreground} on ${background} is ${measured.toFixed(2)}:1, needs ${threshold}:1`,
    )
  }
}

for (const [upper, lower, threshold, what] of steps) {
  const measured = ratio(resolve(root, upper), resolve(root, lower))
  const passed = measured >= threshold
  rows.push([what, `${upper} vs ${lower}`, measured, threshold, passed])
  if (!passed) {
    failures.push(
      `${what} — ${upper} vs ${lower} separates by only ${measured.toFixed(2)}:1, needs ${threshold}:1`,
    )
  }
}

const width = Math.max(...rows.map(([, pair]) => pair.length))
console.log("\nCONSOLE CONTRAST — measured from src/app/globals.css\n")
console.log(`${"PAIR".padEnd(width + 2)}${"RATIO".padStart(7)}  NEED  `)
console.log("-".repeat(width + 30))
for (const [what, pair, measured, threshold, passed] of rows) {
  console.log(
    `${pair.padEnd(width + 2)}${`${measured.toFixed(2)}:1`.padStart(7)}  ` +
      `${`${threshold}`.padStart(4)}  ${passed ? "pass" : "FAIL"}  ${what}`,
  )
}

if (failures.length > 0) {
  console.error(`\n${failures.length} contrast failure(s):\n`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

console.log(`\n${rows.length} pairs measured, all pass.\n`)
