import "server-only"

/**
 * The only module allowed to read server `process.env`.
 *
 * Reading here fails closed at startup rather than at the first request, so a
 * missing or malformed value can never reach a protected route as `undefined`.
 */

export class ServerEnvironmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ServerEnvironmentError"
  }
}

/**
 * Values that must never be exposed to the browser. A `NEXT_PUBLIC_` copy of
 * any of these is a build failure, not a warning: the prefix is what Next.js
 * uses to decide it may be inlined into client bundles.
 */
export const BROWSER_FORBIDDEN_VARIABLES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_JWT_SECRET",
  "DATABASE_URL",
  "DATABASE_DSN",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "CONSOLE_CSRF_SIGNING_KEY",
  "CONSOLE_BFF_PROOF_SIGNING_KEY",
] as const

export type BrowserForbiddenVariable = (typeof BROWSER_FORBIDDEN_VARIABLES)[number]

export type ServerEnvironment = {
  readonly supabaseUrl: string
  readonly supabasePublishableKey: string
  readonly consoleApiBaseUrl: string
  /**
   * Where a customer installs the Evirion GitHub App. Deployment
   * configuration, not a credential: the App private key and installation
   * tokens stay in the backend control plane and never reach this process.
   */
  readonly githubAppInstallUrl: string
  readonly canonicalOrigin: string
  readonly trustedProxyHops: number
  /** 256-bit minimum. Signs the double-submit CSRF proof. */
  readonly csrfSigningKey: string
  /**
   * An Ed25519 private JWK carrying a `kid`, serialised as JSON. The backend
   * verifies with the matching public JWK and selects it by that identifier, so
   * a key without one signs proofs nothing can check. Shape is enforced where
   * it is imported rather than here, because this module owns presence.
   */
  readonly bootstrapProofSigningKey: string
  /** Loopback origin for server-to-server replays through the BFF. */
  readonly internalOrigin: string
  /** Permits the console-stub TOTP double outside production. */
  readonly allowStubAuth: boolean
}

const MINIMUM_SIGNING_KEY_BYTES = 32

/** A plain record rather than `NodeJS.ProcessEnv`, so a test can supply an
 * exact environment instead of one carrying whatever the runner inherited. */
export type EnvironmentSource = Record<string, string | undefined>

const requireValue = (source: EnvironmentSource, name: string): string => {
  const value = source[name]
  if (value === undefined || value.trim() === "") {
    throw new ServerEnvironmentError(`missing required server variable: ${name}`)
  }
  return value.trim()
}

const requireSigningKey = (source: EnvironmentSource, name: string): string => {
  const value = requireValue(source, name)
  if (new TextEncoder().encode(value).length < MINIMUM_SIGNING_KEY_BYTES) {
    throw new ServerEnvironmentError(
      `${name} must carry at least ${MINIMUM_SIGNING_KEY_BYTES * 8} bits`,
    )
  }
  return value
}

const requireHttpsUrl = (source: EnvironmentSource, name: string): string => {
  const value = requireValue(source, name)
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new ServerEnvironmentError(`${name} must be an absolute URL`)
  }
  if (parsed.protocol !== "https:") {
    throw new ServerEnvironmentError(`${name} must use https`)
  }
  return value
}

/**
 * A secret-shaped variable exposed under `NEXT_PUBLIC_` would be inlined into
 * the browser bundle, so it fails the build rather than the request.
 */
export const assertNoPublicSecrets = (source: EnvironmentSource): void => {
  const exposed = BROWSER_FORBIDDEN_VARIABLES.filter(
    (name) => source[`NEXT_PUBLIC_${name}`] !== undefined,
  ).map((name) => `NEXT_PUBLIC_${name}`)

  const suffixed = Object.keys(source).filter(
    (name) =>
      name.startsWith("NEXT_PUBLIC_") &&
      /(SERVICE_ROLE|SECRET|PRIVATE_KEY|_DSN|PASSWORD|_TOKEN|API_KEY|SIGNING_KEY)/.test(
        name,
      ),
  )

  const offending = [...new Set([...exposed, ...suffixed])].toSorted()
  if (offending.length > 0) {
    throw new ServerEnvironmentError(
      `secret-like variables must not be browser-exposed: ${offending.join(", ")}`,
    )
  }
}

export const readServerEnvironment = (
  source: EnvironmentSource = process.env,
): ServerEnvironment => {
  assertNoPublicSecrets(source)

  const canonicalOrigin = requireHttpsUrl(source, "CONSOLE_CANONICAL_ORIGIN")
  const parsedOrigin = new URL(canonicalOrigin)
  if (
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search !== "" ||
    parsedOrigin.hash !== ""
  ) {
    throw new ServerEnvironmentError(
      "CONSOLE_CANONICAL_ORIGIN must be exactly one origin with no path, query or fragment",
    )
  }

  // The baseline fixes one trusted edge hop. A larger value would let a client
  // forge the canonical values the edge is supposed to own.
  const hops = source["CONSOLE_TRUSTED_PROXY_HOPS"]?.trim() ?? "1"
  if (hops !== "1") {
    throw new ServerEnvironmentError("CONSOLE_TRUSTED_PROXY_HOPS must be 1")
  }

  return {
    supabaseUrl: requireHttpsUrl(source, "SUPABASE_URL"),
    supabasePublishableKey: requireValue(source, "SUPABASE_PUBLISHABLE_KEY"),
    consoleApiBaseUrl: requireHttpsUrl(source, "CONSOLE_API_BASE_URL"),
    githubAppInstallUrl: requireHttpsUrl(source, "CONSOLE_GITHUB_APP_INSTALL_URL"),
    canonicalOrigin: parsedOrigin.origin,
    trustedProxyHops: 1,
    csrfSigningKey: requireSigningKey(source, "CONSOLE_CSRF_SIGNING_KEY"),
    bootstrapProofSigningKey: requireSigningKey(
      source,
      "CONSOLE_BFF_PROOF_SIGNING_KEY",
    ),
    internalOrigin: `http://127.0.0.1:${source["CONSOLE_UPSTREAM_PORT"]?.trim() ?? "3000"}`,
    allowStubAuth:
      (source["NODE_ENV"]?.trim() ?? "development") !== "production" ||
      source["CONSOLE_ALLOW_STUB_AUTH"]?.trim() === "true",
  }
}
