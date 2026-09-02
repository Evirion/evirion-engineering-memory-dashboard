import type { NextConfig } from "next"

// Security headers that do not depend on the per-response CSP nonce live here.
// The nonce-bearing Content-Security-Policy is applied in src/proxy.ts, because
// a static config cannot mint a value per response.
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // NFR-SEC-003 and SEC-WEB-008: no production source maps outside an
  // explicitly approved protected upload channel, which does not exist yet.
  productionBrowserSourceMaps: false,
  typescript: { ignoreBuildErrors: false },
  outputFileTracingExcludes: {
    "*": ["./tools/**", "./tests/**", "./docs/**", "./vendor/**"],
  },
}

export default config
