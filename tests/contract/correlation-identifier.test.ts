import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { buildConsoleHeaders, newCorrelationId } from "@/server/adapters/console-api"

import { repositoryRoot } from "../support/source-tree"

/**
 * The backend refuses a correlation identifier that is not a UUID, before it
 * looks at the route or the caller:
 *
 *   if (suppliedCorrelationId !== null && !isUuid(suppliedCorrelationId))
 *     return finish("REQUEST_INVALID")
 *
 * Six read paths each carried their own eight-byte hex generator, so every
 * protected page answered `422` and rendered "Check the highlighted fields and
 * try again" — on pages that have no fields. Observed against the deployed
 * Console on 2026-09-07, with a fully activated session and one membership.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const queryRoot = new URL("src/server/queries/", repositoryRoot)

describe("every backend call names itself in a shape the backend accepts", () => {
  it("issues a UUID", () => {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      expect(newCorrelationId()).toMatch(UUID)
    }
  })

  it("puts it on the header the backend reads", () => {
    const headers = buildConsoleHeaders({
      method: "GET",
      path: "/v1/session/context",
      accessToken: "token",
      correlationId: newCorrelationId(),
    })

    expect(headers.get("x-correlation-id")).toMatch(UUID)
  })

  it("leaves no read path minting its own", () => {
    // The eight-byte hex generator was copied into six files. A seventh copy
    // would break exactly the pages this test exists to keep working, and it
    // would do it silently, so the shape is refused at the source.
    const offenders = readdirSync(fileURLToPath(queryRoot))
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .filter((name) =>
        readFileSync(fileURLToPath(new URL(name, queryRoot)), "utf8").includes(
          "crypto.getRandomValues",
        ),
      )

    expect(offenders).toEqual([])
  })
})
