import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { repositoryRoot } from "../support/source-tree"

/**
 * The Console renders next to the backend it reads.
 *
 * Vercel's default compute region is `iad1`, Washington. The Supabase project
 * is `eu-north-1`, Stockholm. Nobody chose that pairing, and it put the
 * Atlantic between the render and every call it makes: observed on the deployed
 * Console as `x-vercel-id: arn1::iad1::…`, with three sequential backend calls
 * per navigation at 500–900 ms each.
 *
 * `arn1` is Vercel's Stockholm region. Moving the database means moving this.
 */

const BACKEND_REGION = "eu-north-1"
const COMPUTE_REGION = "arn1"

describe("where the Console runs", () => {
  it("pins one region rather than leaving the default", () => {
    const config: unknown = JSON.parse(
      readFileSync(fileURLToPath(new URL("vercel.json", repositoryRoot)), "utf8"),
    )

    expect(config).toMatchObject({ regions: [COMPUTE_REGION] })
  })

  it("names the backend region it was chosen to match", () => {
    // The pairing is the point. A future reader moving either one needs the
    // other named where they will look.
    const source = readFileSync(
      fileURLToPath(new URL("tests/contract/compute-region.test.ts", repositoryRoot)),
      "utf8",
    )

    expect(source).toContain(BACKEND_REGION)
  })
})
