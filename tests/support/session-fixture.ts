import type { BrowserContext } from "@playwright/test"

import {
  SESSION_COOKIE_BASE,
  createGeneration,
  serializeSessionCookies,
} from "@/lib/auth/session-cookies"
import { SESSION_POLICY } from "@/lib/auth/session-policy"

/**
 * Put an authenticated principal in the browser for a journey test.
 *
 * The session cookie is the product's own format, produced by the product's
 * own serializer, so a drift in chunking or attributes fails the journey rather
 * than being papered over by a hand-rolled copy. The bearer token inside is a
 * documented double identity that the local Console API double recognises; it
 * authenticates nothing outside this harness.
 *
 * The session-bound CSRF proof is deliberately not minted here. The proxy
 * issues it on the first authenticated response, so a test that receives a
 * usable form has proved that path rather than bypassed it.
 */
export const STUB_HOSTNAME = "console.evirion.test"

export type StubPrincipal = "console-stub-owner" | "console-stub-viewer"

export const signIn = async (
  context: BrowserContext,
  token: StubPrincipal = "console-stub-owner",
): Promise<void> => {
  const now = Math.floor(Date.now() / 1000)
  const session = {
    accessToken: token,
    refreshToken: `${token}-refresh`,
    providerSessionId: "00000000-0000-4000-8000-00000000d001",
    accessTokenExpiresAt: now + SESSION_POLICY.jwtLifetimeSeconds,
    absoluteExpiresAt: now + SESSION_POLICY.absoluteSessionSeconds,
  }

  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url")
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
}

/** Load a named scenario into the Console API double before driving the UI. */
export const useScenario = async (
  context: BrowserContext,
  scenario: string,
): Promise<void> => {
  const response = await context.request.post(
    "https://127.0.0.1:3444/__stub/scenario",
    { data: { scenario }, ignoreHTTPSErrors: true },
  )
  if (!response.ok()) {
    throw new Error(`could not load stub scenario ${scenario}: ${response.status()}`)
  }
}
