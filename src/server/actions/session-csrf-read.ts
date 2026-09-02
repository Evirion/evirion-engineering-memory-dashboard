import "server-only"

import { cookies } from "next/headers"

import { SESSION_CSRF_COOKIE } from "./session-csrf"

/**
 * Read the session-bound CSRF proof a protected page renders into its forms.
 *
 * The proxy mints it, because a Server Component may not write a cookie. This
 * side is read-only, and an absent proof simply means the mutation fails
 * closed rather than being attempted without one.
 */
export const readSessionCsrfToken = async (): Promise<string> => {
  const jar = await cookies()
  return jar.get(SESSION_CSRF_COOKIE)?.value ?? ""
}
