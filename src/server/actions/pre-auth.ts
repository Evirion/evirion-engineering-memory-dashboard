import "server-only"

import { cookies } from "next/headers"

import { PRE_AUTH_CSRF_COOKIE } from "@/lib/auth/pre-auth-cookies"
import { readServerEnvironment } from "@/lib/env/server"

/**
 * Read the pre-auth CSRF proof a page must render into its form.
 *
 * The proxy mints the transaction and its proof, because a Server Component
 * may not write a cookie. This side is read-only on purpose.
 */
export const readPreAuthCsrfToken = async (): Promise<string> => {
  const jar = await cookies()
  return jar.get(PRE_AUTH_CSRF_COOKIE)?.value ?? ""
}

/**
 * The email identity travels as an HMAC, never as an address, so a pre-auth
 * cookie cannot disclose who is signing in.
 */
export const hmacEmailIdentity = async (email: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(readServerEnvironment().csrfSigningKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(email.trim().toLowerCase()),
  )
  return Buffer.from(new Uint8Array(signature)).toString("base64url")
}
