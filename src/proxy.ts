import { NextResponse, type NextRequest } from "next/server"

import { NONCE_HEADER, buildSecurityHeaders, createNonce } from "@/lib/security/headers"

/**
 * Next.js 16 calls this the proxy; it is the former middleware entry point.
 * It mints one CSP nonce per response and binds it to the enforced header, so
 * a warm instance can never reuse a nonce across two responses.
 */
export const proxy = (request: NextRequest): NextResponse => {
  const nonce = createNonce()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(NONCE_HEADER, nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  const headers = buildSecurityHeaders({
    nonce,
    isProduction: process.env.NODE_ENV === "production",
  })
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
