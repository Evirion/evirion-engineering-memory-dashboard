import "server-only"

import { createSupabaseAuthProvider, type AuthProvider } from "./auth-provider"
import { createStubAuthProvider, isStubAccessToken } from "./stub-auth-provider"
import { readServerEnvironment } from "@/lib/env/server"

export const createAuthProviderForAccessToken = (accessToken: string): AuthProvider => {
  const environment = readServerEnvironment()
  if (environment.allowStubAuth && isStubAccessToken(accessToken)) {
    return createStubAuthProvider(accessToken)
  }
  return createSupabaseAuthProvider()
}
