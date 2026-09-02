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

/**
 * One-time browser-visible privileged material. It is returned only to a
 * dynamic `private, no-store` response and never enters router cache,
 * prefetch, analytics, logs, audit metadata or later navigation state.
 */
export type TotpEnrolment = {
  readonly factorId: string
  readonly qrCode: string
  readonly secret: string
}

export type TotpChallenge = { readonly factorId: string; readonly challengeId: string }

export type AuthProvider = {
  /** Send an email OTP. `shouldCreateUser` is always false: no public signup. */
  requestEmailOtp(email: string): Promise<AuthOutcome<null>>
  verifyEmailOtp(email: string, code: string): Promise<AuthOutcome<IssuedTokens>>
  /** Online validation of the exact token. Never trusts cached user metadata. */
  getUser(accessToken: string): Promise<AuthOutcome<VerifiedUser>>
  refresh(refreshToken: string): Promise<AuthOutcome<IssuedTokens>>
  signOut(accessToken: string, scope: SignOutScope): Promise<AuthOutcome<null>>
  enrollTotp(accessToken: string): Promise<AuthOutcome<TotpEnrolment>>
  challengeTotp(accessToken: string): Promise<AuthOutcome<TotpChallenge>>
  verifyTotp(
    accessToken: string,
    challenge: TotpChallenge,
    code: string,
  ): Promise<AuthOutcome<IssuedTokens>>
}

const REQUEST_LOCAL_AUTH = {
  // Nothing about this client may outlive the request, and it must never
  // write a token anywhere the browser can reach.
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const

const anonymousClient = () => {
  const environment = readServerEnvironment()
  return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: REQUEST_LOCAL_AUTH,
  })
}

/** A request-local client acting as the caller, never as a service role. */
const callerClient = (accessToken: string) => {
  const environment = readServerEnvironment()
  return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: REQUEST_LOCAL_AUTH,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
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
      const { error } = await callerClient(accessToken).auth.signOut({ scope })
      return error
        ? { status: "denied", reason: "sign-out-rejected" }
        : { status: "ok", value: null }
    } catch {
      // Application denial has already committed; the provider effect is
      // reconciled by observation, never by a blind retry.
      return { status: "unknown" }
    }
  },

  async enrollTotp(accessToken) {
    try {
      const { data, error } = await callerClient(accessToken).auth.mfa.enroll({
        factorType: "totp",
      })
      if (error || !data) return { status: "denied", reason: "enrolment-denied" }

      return {
        status: "ok",
        value: {
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        },
      }
    } catch {
      return { status: "unknown" }
    }
  },

  async challengeTotp(accessToken) {
    try {
      const client = callerClient(accessToken)
      const { data: factors, error: listError } = await client.auth.mfa.listFactors()
      const factor = factors?.totp?.find((candidate) => candidate.status === "verified")
      if (listError || !factor)
        return { status: "denied", reason: "no-verified-factor" }

      const { data, error } = await client.auth.mfa.challenge({ factorId: factor.id })
      if (error || !data) return { status: "denied", reason: "challenge-denied" }

      return { status: "ok", value: { factorId: factor.id, challengeId: data.id } }
    } catch {
      return { status: "unknown" }
    }
  },

  async verifyTotp(accessToken, challenge, code) {
    try {
      const { data, error } = await callerClient(accessToken).auth.mfa.verify({
        factorId: challenge.factorId,
        challengeId: challenge.challengeId,
        code,
      })
      if (error || !data) return { status: "denied", reason: "totp-rejected" }

      return {
        status: "ok",
        value: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          // The MFA verify response reports a relative lifetime, not an
          // absolute expiry, so it is converted rather than assumed.
          accessTokenExpiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
          sessionId: extractSessionId(data.access_token),
        },
      }
    } catch {
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
