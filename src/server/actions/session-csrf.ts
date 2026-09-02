import "server-only"

import { COOKIE_ATTRIBUTES } from "@/lib/auth/session-cookies"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { readServerEnvironment } from "@/lib/env/server"
import { importCsrfKey, issueCsrfToken } from "@/lib/security/csrf"

/**
 * The post-authentication CSRF proof, bound to the live `session_id`.
 *
 * It is minted on the protected shell and rotates whenever the session
 * identity changes, so a proof that survived a logout or a session swap no
 * longer matches the binding the guard expects.
 */

export const SESSION_CSRF_COOKIE = "__Host-console-session-csrf"

export const issueSessionCsrfToken = async (sessionId: string): Promise<string> =>
  issueCsrfToken(
    await importCsrfKey(readServerEnvironment().csrfSigningKey),
    { kind: "session", sessionId },
    {
      issuedAt: Math.floor(Date.now() / 1000),
      lifetimeSeconds: SESSION_POLICY.absoluteSessionSeconds,
    },
  )

export const sessionCsrfCookie = (token: string) => ({
  name: SESSION_CSRF_COOKIE,
  value: token,
  ...COOKIE_ATTRIBUTES,
  maxAge: SESSION_POLICY.absoluteSessionSeconds,
})

export const clearSessionCsrfCookie = () => ({
  name: SESSION_CSRF_COOKIE,
  value: "",
  ...COOKIE_ATTRIBUTES,
  maxAge: 0,
})
