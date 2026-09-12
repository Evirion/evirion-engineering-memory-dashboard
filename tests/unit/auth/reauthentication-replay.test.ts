import { describe, expect, it } from "vitest"

import { MUTATION_PATHS_FOR_GATE } from "@/lib/auth/reauthentication-action-class"
import { resolveMutationHandler } from "@/server/actions/reauthentication-replay"

describe("replay mutation handlers", () => {
  it("resolves every allowlisted path, including repository policy", async () => {
    const paths = Object.values(MUTATION_PATHS_FOR_GATE).flat()

    expect(paths).toContain("/api/repositories/policy")

    const handlers = await Promise.all(
      paths.map(async (path) => [path, await resolveMutationHandler(path)] as const),
    )
    for (const [path, handler] of handlers) {
      expect(handler, `${path} must have a replay handler`).toEqual(
        expect.any(Function),
      )
    }
  })
})
