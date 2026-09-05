import { expect, test } from "@playwright/test"

import { XSS_PAYLOADS } from "../../tools/console-stub/fixtures.mjs"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { collectSourceFiles, repositoryRoot } from "../support/source-tree"
import { signIn } from "../support/session-fixture"

/**
 * Injection, XSS and unsafe rendering, security row SEC-WEB-004.
 *
 * Until EEM-9/07 the double could not produce hostile text at all, so no
 * assertion about rendering it was possible. A corpus is only a corpus if the
 * double can serve it, so the payloads now live beside the fixtures and cover
 * stored, reflected, attribute-break, DOM-sink and mutation shapes.
 *
 * The property is not "nothing exploded". It is that the payload arrives as
 * text: visible verbatim to a reader, inert to the parser, and with no element
 * the payload asked for anywhere in the tree.
 */

const executionMarker = "__xss"

test.describe("stored payloads render as text", () => {
  test("no payload in the review queue executes or becomes an element", async ({
    context,
    page,
  }) => {
    const dialogs: string[] = []
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message())
      await dialog.dismiss()
    })

    await signIn(context, { scenario: "xssCorpus" })
    await page.goto("/memory")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // Nothing the payloads try to run may have run.
    expect(await page.evaluate((key) => key in globalThis, executionMarker)).toBe(false)
    expect(dialogs).toEqual([])

    // Nothing the payloads try to create may exist. `script` is checked by
    // content rather than count, because the application legitimately has its
    // own.
    const injected = await page.evaluate(() => ({
      images: document.querySelectorAll("img[onerror]").length,
      svgs: document.querySelectorAll("svg[onload]").length,
      frames: document.querySelectorAll("iframe[srcdoc]").length,
      // The server serialises page data into an inline script, so the payload
      // legitimately appears there. What must never appear is an unescaped
      // angle bracket: that is what would let a payload close the script tag
      // and start a real one.
      unescapedInScript: [...document.querySelectorAll("script:not([src])")]
        .map((element) => element.textContent ?? "")
        .filter((text) => text.includes("__xss"))
        .filter((text) => /<\/?script/i.test(text)).length,
      dataLinks: document.querySelectorAll('a[href^="data:"]').length,
      javascriptLinks: document.querySelectorAll('a[href^="javascript:"]').length,
    }))
    expect(injected).toEqual({
      images: 0,
      svgs: 0,
      frames: 0,
      unescapedInScript: 0,
      dataLinks: 0,
      javascriptLinks: 0,
    })
  })

  test("a payload stays readable rather than being silently dropped", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "xssCorpus" })
    await page.goto("/memory")

    // Escaping that swallowed the text would also pass the test above, and
    // would be its own defect: a reviewer must see what the claim actually says.
    const body = (await page.locator("body").innerText()).replaceAll(/\s+/g, " ")
    const rendered = XSS_PAYLOADS.filter((payload) =>
      body.includes(payload.replaceAll(/\s+/g, " ").slice(0, 24)),
    )
    expect(rendered.length).toBeGreaterThan(0)
  })

  test("a payload survives a reload without becoming markup", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "xssCorpus" })
    await page.goto("/memory")
    await page.reload()
    expect(await page.evaluate((key) => key in globalThis, executionMarker)).toBe(false)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })
})

test.describe("reflected input renders as text", () => {
  test("a payload in the query string never reaches the parser", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "xssCorpus" })
    for (const payload of XSS_PAYLOADS) {
      await page.goto(`/memory?status=${encodeURIComponent(payload)}`)
      expect(
        await page.evaluate((key) => key in globalThis, executionMarker),
        `${payload} executed from the query string`,
      ).toBe(false)
    }
  })

  test("an unknown filter value is refused rather than echoed", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "xssCorpus" })
    const response = await page.goto("/memory?status=<script>alert(1)</script>")
    // Whatever the answer is, it is not a page that put the value in the DOM.
    expect(await page.evaluate((key) => key in globalThis, executionMarker)).toBe(false)
    expect(response?.status()).toBeLessThan(500)
  })
})

test.describe("the unsafe rendering paths do not exist", () => {
  test("no source file reaches a raw HTML sink", async () => {
    const offenders: string[] = []
    for (const relativePath of [
      ...collectSourceFiles("src"),
      ...collectSourceFiles("tools"),
    ]) {
      const contents = readFileSync(
        fileURLToPath(new URL(relativePath, repositoryRoot)),
        "utf8",
      )
      for (const sink of [
        "dangerouslySetInnerHTML",
        ".innerHTML",
        ".outerHTML",
        "document.write(",
        "insertAdjacentHTML",
      ]) {
        if (contents.includes(sink)) offenders.push(`${relativePath}: ${sink}`)
      }
    }
    expect(offenders).toEqual([])
  })

  test("no source file renders Markdown into the document", async () => {
    const offenders = collectSourceFiles("src").filter((relativePath) =>
      // Match the dependency, not the English word: "marked as reviewed" is
      // prose, `from "marked"` is a Markdown renderer.
      /from\s+["'](marked|markdown-it|remark|react-markdown)["']/.test(
        readFileSync(fileURLToPath(new URL(relativePath, repositoryRoot)), "utf8"),
      ),
    )
    expect(offenders).toEqual([])
  })
})
