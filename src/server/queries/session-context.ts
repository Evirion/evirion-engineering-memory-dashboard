import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import type { SessionContext } from "@contracts/console"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { describeTreatment, mapConsoleError } from "@/lib/errors/console-errors"
import { fetchSessionContext } from "@/server/adapters/console-api"

/**
 * The one place a protected page learns who the caller is.
 *
 * The context is a live server projection re-derived per request. It is never
 * cached, never read from a cookie, and never inferred from navigation state.
 * Capabilities come from the backend; the UI only reflects them.
 */

export type ProtectedContext =
  | { readonly status: "ready"; readonly context: SessionContext }
  | { readonly status: "unavailable"; readonly message: string }

const correlationId = (): string => {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("hex")
}

export const requireSessionContext = async (): Promise<ProtectedContext> => {
  const jar = await cookies()
  const outcome = readSession(
    Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])),
  )

  if (outcome.status === "rejected") {
    // Every bounded slot is cleared before the caller is sent back to sign-in,
    // so a malformed set cannot survive into the next request.
    for (const instruction of outcome.clear) {
      jar.set({ ...instruction, sameSite: "lax" })
    }
    redirect("/auth/sign-in")
  }

  if (outcome.status === "anonymous") redirect("/auth/sign-in")

  const environment = readServerEnvironment()
  const result = await fetchSessionContext(environment.consoleApiBaseUrl, {
    accessToken: outcome.session.accessToken,
    correlationId: correlationId(),
  })

  if (result.ok) return { status: "ready", context: result.value }

  switch (result.failure.kind) {
    case "error": {
      const mapped = mapConsoleError(result.failure.error)
      if (mapped.treatment === "sign-in-required") redirect("/auth/sign-in")
      return { status: "unavailable", message: describeTreatment(mapped.treatment) }
    }
    case "unsupported":
      // Fail closed rather than render a partial document.
      return { status: "unavailable", message: describeTreatment("unknown-outcome") }
    case "unreachable":
      return { status: "unavailable", message: describeTreatment("retry-bounded") }
    default: {
      const exhaustive: never = result.failure
      throw new Error(`unhandled console failure: ${JSON.stringify(exhaustive)}`)
    }
  }
}
