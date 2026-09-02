import { randomUUID } from "node:crypto"

import type { BrowserContext } from "@playwright/test"

import {
  SESSION_COOKIE_BASE,
  createGeneration,
  serializeSessionCookies,
} from "@/lib/auth/session-cookies"
import { SESSION_POLICY } from "@/lib/auth/session-policy"

import type { StubScenarioName } from "../../tools/console-stub/fixtures.mjs"

/**
 * Put an authenticated principal in the browser for a journey test.
 *
 * The session cookie is the product's own format, produced by the product's
 * own serializer, so a drift in chunking or attributes fails the journey rather
 * than being papered over by a hand-rolled copy.
 *
 * The bearer token carries an isolation identifier as well as the principal.
 * The Console forwards the caller token unchanged, so that identifier is what
 * gives each test its own scenario state in the shared double. Without it the
 * suite cannot run in parallel: one test switching scenario would change what
 * every other test sees.
 *
 * The session-bound CSRF proof is deliberately not minted here. The proxy
 * issues it on the first authenticated response, so a test that receives a
 * usable form has proved that path rather than bypassed it.
 */
export const STUB_HOSTNAME = "console.evirion.test"
export const STUB_ORIGIN = "https://127.0.0.1:3444"

export type StubPrincipal = "console-stub-owner" | "console-stub-viewer"

export type SignedInSession = {
  /** Pass to a direct BFF or backend call that must act as the same caller. */
  readonly token: string
  readonly isolation: string
}

export const signIn = async (
  context: BrowserContext,
  options: {
    readonly scenario?: StubScenarioName
    readonly principal?: StubPrincipal
  } = {},
): Promise<SignedInSession> => {
  const isolation = randomUUID()
  const token = `${options.principal ?? "console-stub-owner"}|${isolation}`

  const loaded = await context.request.post(`${STUB_ORIGIN}/__stub/scenario`, {
    data: { scenario: options.scenario ?? "default", isolation },
    ignoreHTTPSErrors: true,
  })
  if (!loaded.ok()) {
    throw new Error(`could not load stub scenario: ${loaded.status()}`)
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      accessToken: token,
      refreshToken: `${token}-refresh`,
      providerSessionId: "00000000-0000-4000-8000-00000000d001",
      accessTokenExpiresAt: now + SESSION_POLICY.jwtLifetimeSeconds,
      absoluteExpiresAt: now + SESSION_POLICY.absoluteSessionSeconds,
    }),
    "utf8",
  ).toString("base64url")

  const instructions = serializeSessionCookies(
    SESSION_COOKIE_BASE,
    payload,
    createGeneration(),
    SESSION_POLICY.absoluteSessionSeconds,
  )

  await context.addCookies(
    instructions.map((instruction) => ({
      name: instruction.name,
      value: instruction.value,
      domain: STUB_HOSTNAME,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax" as const,
      expires: now + instruction.maxAge,
    })),
  )

  return { token, isolation }
}
