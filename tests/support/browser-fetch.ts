import type { Page } from "@playwright/test"

/**
 * Issue same-origin requests from inside the browser.
 *
 * Playwright's `request` fixture runs in Node, where the pinned local
 * hostname has no DNS record and the leaf is trusted only by Chromium's SPKI
 * pin. Driving these through the page keeps every assertion on the real
 * origin, which is the point of the pinned HTTPS harness.
 */
export type ProbedResponse = {
  readonly path: string
  readonly status: number
  readonly headers: Record<string, string>
}

export const probe = async (page: Page, paths: string[]): Promise<ProbedResponse[]> =>
  page.evaluate(
    async (targets: string[]) =>
      Promise.all(
        targets.map(async (path) => {
          const response = await fetch(path, { redirect: "manual", cache: "no-store" })
          const headers: Record<string, string> = {}
          response.headers.forEach((value, name) => {
            headers[name] = value
          })
          return { path, status: response.status, headers }
        }),
      ),
    paths,
  )

export const probeOne = async (page: Page, path: string): Promise<ProbedResponse> => {
  const [only] = await probe(page, [path])
  if (!only) throw new Error(`no response observed for ${path}`)
  return only
}
