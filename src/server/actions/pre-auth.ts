import "server-only"

import { cookies } from "next/headers"

import {
  OPAQUE_INVITATION_ID,
  PRE_AUTH_ADDRESS_COOKIE,
  PRE_AUTH_CSRF_COOKIE,
  PRE_AUTH_INVITATION_COOKIE,
} from "@/lib/auth/pre-auth-cookies"
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

/**
 * Seal and open the address the verify page fills in.
 *
 * AES-GCM under a key derived from the signing key, so only this server can
 * read it and a tampered value fails to open rather than decoding to something
 * attacker-chosen. The HMAC binding still decides whether a code may be
 * verified; this only spares the reader a second typing of their own address.
 */
const addressKey = async (): Promise<CryptoKey> => {
  const material = new TextEncoder().encode(readServerEnvironment().csrfSigningKey)
  const digest = await crypto.subtle.digest("SHA-256", material)
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ])
}

export const sealEmailAddress = async (email: string): Promise<string> => {
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    await addressKey(),
    new TextEncoder().encode(email.trim().toLowerCase()),
  )
  const packed = new Uint8Array(nonce.length + sealed.byteLength)
  packed.set(nonce)
  packed.set(new Uint8Array(sealed), nonce.length)
  return Buffer.from(packed).toString("base64url")
}

/**
 * The invitation the reader arrived holding, if the sign-in form carried one.
 *
 * Opaque and unverified here on purpose: it selects which backend sign-in path
 * runs, and the backend rechecks the invitation against the verified identity
 * before it grants anything.
 */
export const readCarriedInvitationId = async (): Promise<string> => {
  const value = (await cookies()).get(PRE_AUTH_INVITATION_COOKIE)?.value ?? ""
  return OPAQUE_INVITATION_ID.test(value) ? value : ""
}

export const readSealedEmailAddress = async (): Promise<string> => {
  const jar = await cookies()
  const value = jar.get(PRE_AUTH_ADDRESS_COOKIE)?.value
  if (!value) return ""
  try {
    const packed = new Uint8Array(Buffer.from(value, "base64url"))
    if (packed.length <= 12) return ""
    const opened = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: packed.subarray(0, 12) },
      await addressKey(),
      packed.subarray(12),
    )
    return new TextDecoder().decode(opened)
  } catch {
    // A cookie that does not open is treated as absent: the reader simply types
    // the address, which is what happened before this existed.
    return ""
  }
}
