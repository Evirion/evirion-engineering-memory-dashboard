// `server-only` throws by design when it is imported outside a React Server
// Component, which is exactly the guarantee it exists to provide. Vitest runs
// server modules directly in Node, so the import is stubbed here.
//
// This does not weaken the boundary: Next.js enforces it at build time, and
// tests/contract/no-browser-secrets.test.ts asserts that no client module
// reaches a server-only concern.
export const SERVER_ONLY_STUB = true
