import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const fromRoot = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@contracts/console": fromRoot("./generated/console-contract/v1/index.ts"),
      "server-only": fromRoot("./tests/support/server-only-stub.ts"),
      "@": fromRoot("./src"),
    },
  },
  test: {
    // Component tests opt into jsdom with an `@vitest-environment` docblock;
    // Vitest 4 removed environmentMatchGlobs.
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/contract/**/*.test.ts",
      "tests/component/**/*.test.tsx",
      "tests/conformance/**/*.test.ts",
    ],
    clearMocks: true,
    restoreMocks: true,
    // A leaked variable from a prior Compose or staging run must not decide a
    // gate result, so nothing is inherited implicitly.
    env: {},
  },
})
