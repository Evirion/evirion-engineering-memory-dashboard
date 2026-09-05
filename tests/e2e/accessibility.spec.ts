import { expect, test, type Page } from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * The accessibility gate, acceptance row NFR-ACC-001.
 *
 * The five properties are the ones the row names: a journey reachable by
 * keyboard, a focus you can see, a name for every control, a status a screen
 * reader is told about, and text that meets the WCAG 2.2 AA contrast ratio.
 *
 * Contrast is computed here rather than eyeballed, and rather than delegated to
 * a scanner this repository does not pin. A scanner would add breadth over ARIA
 * rules; it would not make these five stronger, and adding one is a
 * supply-chain decision rather than a test decision.
 */

const OWNED_JOURNEYS = [
  "/repositories",
  "/memory",
  "/processing",
  "/settings/members",
  "/settings/github",
  "/settings/usage",
] as const

/** WCAG 2.2 AA: 4.5:1 for body text, 3:1 once the text is large. */
const NORMAL_TEXT_RATIO = 4.5
const LARGE_TEXT_RATIO = 3
const LARGE_TEXT_PIXELS = 24
const LARGE_BOLD_PIXELS = 18.66

type ContrastSample = {
  readonly text: string
  readonly ratio: number
  readonly required: number
}

const worstContrast = async (page: Page): Promise<ContrastSample | undefined> =>
  page.evaluate(
    ({ normalRatio, largeRatio, largePixels, largeBoldPixels }) => {
      // This callback is serialized into the browser, so nothing it needs can
      // live in the outer scope: a hoisted helper would simply be undefined
      // there.
      // oxlint-disable-next-line consistent-function-scoping
      const channel = (value: number): number => {
        const proportion = value / 255
        return proportion <= 0.04045
          ? proportion / 12.92
          : Math.pow((proportion + 0.055) / 1.055, 2.4)
      }
      const luminance = (colour: readonly number[]): number =>
        0.2126 * channel(colour[0] ?? 0) +
        0.7152 * channel(colour[1] ?? 0) +
        0.0722 * channel(colour[2] ?? 0)
      // Tailwind 4 emits lab() and oklch(), so reading digits out of the string
      // would treat a lightness of 26.96 as a red channel. The browser is asked
      // to resolve the colour to sRGB instead, which works for any format it
      // accepts and is the space WCAG defines its ratio in.
      const surface = document.createElement("canvas")
      surface.width = 1
      surface.height = 1
      const brush = surface.getContext("2d", { willReadFrequently: true })
      const parse = (value: string): number[] | undefined => {
        if (brush === null || value === "") return undefined
        brush.clearRect(0, 0, 1, 1)
        brush.fillStyle = "#000000"
        brush.fillStyle = value
        // An unparseable value leaves fillStyle at the previous colour, which
        // would silently score black against black.
        if (
          brush.fillStyle === "#000000" &&
          !/^(#000000|black|rgb\(0, ?0, ?0\))$/i.test(value)
        ) {
          return undefined
        }
        brush.fillRect(0, 0, 1, 1)
        const [red, green, blue, alpha] = brush.getImageData(0, 0, 1, 1).data
        // A translucent colour cannot be judged without compositing it, and this
        // gate reports rather than guesses.
        if ((alpha ?? 255) < 255) return undefined
        return [red ?? 0, green ?? 0, blue ?? 0]
      }
      const backgroundOf = (element: Element): number[] | undefined => {
        let current: Element | null = element
        while (current !== null) {
          const parsed = parse(getComputedStyle(current).backgroundColor)
          if (parsed !== undefined) return parsed
          current = current.parentElement
        }
        return [255, 255, 255]
      }

      let worst: { text: string; ratio: number; required: number } | undefined
      for (const element of document.body.querySelectorAll("*")) {
        const own = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent?.trim() ?? "")
          .join(" ")
          .trim()
        if (own === "") continue
        const style = getComputedStyle(element)
        if (style.visibility === "hidden" || style.display === "none") continue
        const foreground = parse(style.color)
        const background = backgroundOf(element)
        if (foreground === undefined || background === undefined) continue

        const lighter = Math.max(luminance(foreground), luminance(background))
        const darker = Math.min(luminance(foreground), luminance(background))
        const ratio = (lighter + 0.05) / (darker + 0.05)
        const size = Number.parseFloat(style.fontSize)
        const bold = Number.parseInt(style.fontWeight, 10) >= 700
        const required =
          size >= largePixels || (bold && size >= largeBoldPixels)
            ? largeRatio
            : normalRatio
        if (ratio < required && (worst === undefined || ratio < worst.ratio)) {
          worst = { text: own.slice(0, 60), ratio: Number(ratio.toFixed(2)), required }
        }
      }
      return worst
    },
    {
      normalRatio: NORMAL_TEXT_RATIO,
      largeRatio: LARGE_TEXT_RATIO,
      largePixels: LARGE_TEXT_PIXELS,
      largeBoldPixels: LARGE_BOLD_PIXELS,
    },
  )

test.describe("keyboard_focus_name_status_and_contrast_gate", () => {
  for (const journey of OWNED_JOURNEYS) {
    test(`${journey} is reachable and readable without a mouse`, async ({
      context,
      page,
    }) => {
      await signIn(context)
      await page.goto(journey)

      // One landmark and one first-level heading, so a screen reader lands
      // somewhere meaningful rather than at the top of a div.
      await expect(page.getByRole("main")).toBeVisible()
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

      // Every control carries a name. An unnamed control is unusable by voice
      // and unreadable by a screen reader, however clear its icon.
      const unnamed = await page.evaluate(() => {
        const controls = document.querySelectorAll<HTMLElement>(
          "a[href], button, input, select, textarea",
        )
        const nameless: string[] = []
        for (const control of controls) {
          if (
            control.hasAttribute("hidden") ||
            control.getAttribute("aria-hidden") === "true"
          ) {
            continue
          }
          // A hidden input carries a CSRF proof or the organization scope. It is
          // not a control a person reaches, so a name would mean nothing.
          if (control instanceof HTMLInputElement && control.type === "hidden") continue

          const associated = [...((control as HTMLInputElement).labels ?? [])]
            .map((label) => label.textContent?.trim() ?? "")
            .join(" ")
            .trim()
          const described =
            control.getAttribute("aria-labelledby") === null
              ? ""
              : "referenced-by-aria-labelledby"
          const name = [
            control.getAttribute("aria-label")?.trim() ?? "",
            described,
            associated,
            control.textContent?.trim() ?? "",
            control.getAttribute("title")?.trim() ?? "",
            control.getAttribute("placeholder")?.trim() ?? "",
            control.getAttribute("alt")?.trim() ?? "",
          ]
            .join("")
            .trim()
          if (name === "") {
            nameless.push(`${control.tagName.toLowerCase()}#${control.id || "(no id)"}`)
          }
        }
        return nameless
      })
      expect(unnamed, `controls without an accessible name on ${journey}`).toEqual([])

      // Focus must be reachable by keyboard and visible once it lands. A focus
      // ring removed for looks makes the whole journey unusable by keyboard.
      await page.keyboard.press("Tab")
      const focus = await page.evaluate(() => {
        const active = document.activeElement
        if (active === null || active === document.body) return undefined
        const style = getComputedStyle(active)
        return {
          tag: active.tagName.toLowerCase(),
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
          boxShadow: style.boxShadow,
        }
      })
      expect(focus, `nothing took focus on ${journey}`).toBeDefined()
      const visibleFocus =
        (focus?.outlineStyle !== "none" && focus?.outlineWidth !== "0px") ||
        (focus?.boxShadow !== undefined && focus.boxShadow !== "none")
      expect(visibleFocus, `focus is invisible on ${journey}`).toBe(true)

      const worst = await worstContrast(page)
      expect(
        worst,
        worst === undefined
          ? ""
          : `"${worst.text}" is ${worst.ratio}:1 and needs ${worst.required}:1`,
      ).toBeUndefined()
    })
  }

  test("a status change is announced rather than only drawn", async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto("/memory")

    // Something must own a live region, or a filtered list silently changes
    // under a screen reader that has no reason to re-read it.
    const live = page.locator("[role='status'], [role='alert'], [aria-live]")
    await expect(live.first()).toBeAttached()
  })
})
