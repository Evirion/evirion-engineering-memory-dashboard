/**
 * The only module allowed to read browser-visible configuration.
 *
 * Next.js inlines `NEXT_PUBLIC_` values into client bundles, so this allowlist
 * is a security boundary rather than a convenience. It carries no Supabase
 * session configuration: the browser never initializes a session-bearing
 * Supabase client.
 */

export class ClientEnvironmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClientEnvironmentError"
  }
}

export const CONSOLE_ENVIRONMENTS = ["local", "staging", "production"] as const

export type ConsoleEnvironmentName = (typeof CONSOLE_ENVIRONMENTS)[number]

export type ClientEnvironment = {
  readonly environment: ConsoleEnvironmentName
}

export const ALLOWED_PUBLIC_VARIABLES = ["NEXT_PUBLIC_CONSOLE_ENVIRONMENT"] as const

const isConsoleEnvironmentName = (value: string): value is ConsoleEnvironmentName =>
  (CONSOLE_ENVIRONMENTS as readonly string[]).includes(value)

export const readClientEnvironment = (
  source: Record<string, string | undefined>,
): ClientEnvironment => {
  const unexpected = Object.keys(source)
    .filter((name) => name.startsWith("NEXT_PUBLIC_"))
    .filter((name) => !(ALLOWED_PUBLIC_VARIABLES as readonly string[]).includes(name))
    .toSorted()
  if (unexpected.length > 0) {
    throw new ClientEnvironmentError(
      `browser variables are allowlisted; remove: ${unexpected.join(", ")}`,
    )
  }

  const environment = source["NEXT_PUBLIC_CONSOLE_ENVIRONMENT"]?.trim() ?? "local"
  if (!isConsoleEnvironmentName(environment)) {
    throw new ClientEnvironmentError(
      `NEXT_PUBLIC_CONSOLE_ENVIRONMENT must be one of ${CONSOLE_ENVIRONMENTS.join(", ")}`,
    )
  }

  return { environment }
}
