import "server-only"

import { createClient } from "@supabase/supabase-js"

import { readServerEnvironment } from "@/lib/env/server"

/**
 * The narrow server-only Auth surface the BFF is allowed to use.
 *
 * `getSession` is deliberately absent: the baseline forbids it, because it
 * returns cached metadata rather than a verified identity. Every call that
 * decides authorization goes through `getUser`, which validates the exact
 * token online.
 *
 * Response loss is modelled explicitly. A provider call whose outcome is
 * unknown is never reported as failure, because the effect may have happened,
 * and it is never retried blind.
 */

export type AuthOutcome<T> =
  | { readonly status: "ok"; readonly value: T }
  | { readonly status: "denied"; readonly reason: string }
  | { readonly status: "unknown" }

export type VerifiedUser = {
  readonly id: string
  readonly email: string
  readonly emailVerified: boolean
  readonly isAnonymous: boolean
  /** Authentication methods the provider reports for this session. */
  readonly amr: readonly string[]
  readonly providers: readonly string[]
  readonly sessionId: string
  readonly currentAal: "aal1" | "aal2"
  readonly nextAal: "aal1" | "aal2"
}

export type IssuedTokens = {
  readonly accessToken: string
  readonly refreshToken: string
  readonly accessTokenExpiresAt: number
  readonly sessionId: string
}

export type SignOutScope = "local" | "others" | "global"

export type AuthProvider = {
  /** Send an email OTP. `shouldCreateUser` is always false: no public signup. */
  requestEmailOtp(email: string): Promise<AuthOutcome<null>>
  verifyEmailOtp(email: string, code: string): Promise<AuthOutcome<IssuedTokens>>
  /** Online validation of the exact token. Never trusts cached user metadata. */
  getUser(accessToken: string): Promise<AuthOutcome<VerifiedUser>>
  refresh(refreshToken: string): Promise<AuthOutcome<IssuedTokens>>
  signOut(accessToken: string, scope: SignOutScope): Promise<AuthOutcome<null>>
}

const anonymousClient = () => {
  const environment = readServerEnvironment()
  return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: {
      // Nothing about this client may outlive the request, and it must never
      // write a token anywhere the browser can reach.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

const expiresAtSeconds = (expiresAt: number | undefined): number =>
  expiresAt ?? Math.floor(Date.now() / 1000)

const asAal = (value: unknown): "aal1" | "aal2" => (value === "aal2" ? "aal2" : "aal1")

export const createSupabaseAuthProvider = (): AuthProvider => ({
  async requestEmailOtp(email) {
    try {
      const { error } = await anonymousClient().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      // The response is generic on purpose: a distinguishable error here is an
      // account-enumeration oracle.
      return error
        ? { status: "denied", reason: "otp-request-denied" }
        : { status: "ok", value: null }
    } catch {
      // The request may already have dispatched an email, so this is unknown
      // rather than failed, and it is never retried automatically.
      return { status: "unknown" }
    }
  },

  async verifyEmailOtp(email, code) {
    try {
      const { data, error } = await anonymousClient().auth.verifyOtp({
        email,
        token: code,
        type: "email",
      })
      if (error || !data.session)
        return { status: "denied", reason: "otp-verify-denied" }

      return {
        status: "ok",
        value: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          accessTokenExpiresAt: expiresAtSeconds(data.session.expires_at),
          sessionId: extractSessionId(data.session.access_token),
        },
      }
    } catch {
      return { status: "unknown" }
    }
  },

  async getUser(accessToken) {
    try {
      const { data, error } = await anonymousClient().auth.getUser(accessToken)
      if (error || !data.user) return { status: "denied", reason: "token-rejected" }

      const claims = decodeClaims(accessToken)
      const identities = data.user.identities ?? []

      return {
        status: "ok",
        value: {
          id: data.user.id,
          email: data.user.email ?? "",
          emailVerified: Boolean(data.user.email_confirmed_at),
          isAnonymous: Boolean(data.user.is_anonymous),
          amr: Array.isArray(claims["amr"])
            ? (claims["amr"] as { method?: string }[]).map(
                (entry) => entry.method ?? "",
              )
            : [],
          providers: identities.map((identity) => identity.provider),
          sessionId:
            typeof claims["session_id"] === "string" ? claims["session_id"] : "",
          currentAal: asAal(claims["aal"]),
          nextAal: asAal(claims["aal"]),
        },
      }
    } catch {
      // Auth unavailability is a fail-closed deny with no domain side effect.
      return { status: "unknown" }
    }
  },

  async refresh(refreshToken) {
    try {
      const { data, error } = await anonymousClient().auth.refreshSession({
        refresh_token: refreshToken,
      })
      if (error || !data.session)
        return { status: "denied", reason: "refresh-rejected" }

      return {
        status: "ok",
        value: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          accessTokenExpiresAt: expiresAtSeconds(data.session.expires_at),
          sessionId: extractSessionId(data.session.access_token),
        },
      }
    } catch {
      return { status: "unknown" }
    }
  },

  async signOut(accessToken, scope) {
    try {
      // Signing out uses the caller's own token. The admin surface would need
      // a service-role key, which the BFF must never hold.
      const environment = readServerEnvironment()
      const client = createClient(
        environment.supabaseUrl,
        environment.supabasePublishableKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
        },
      )
      const { error } = await client.auth.signOut({ scope })
      return error
        ? { status: "denied", reason: "sign-out-rejected" }
        : { status: "ok", value: null }
    } catch {
      // Application denial has already committed; the provider effect is
      // reconciled by observation, never by a blind retry.
      return { status: "unknown" }
    }
  },
})

/** Read unverified claims for routing only. Authorization uses `getUser`. */
export const decodeClaims = (accessToken: string): Record<string, unknown> => {
  const body = accessToken.split(".")[1]
  if (!body) return {}
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >
  } catch {
    return {}
  }
}

export const extractSessionId = (accessToken: string): string => {
  const value = decodeClaims(accessToken)["session_id"]
  return typeof value === "string" ? value : ""
}
