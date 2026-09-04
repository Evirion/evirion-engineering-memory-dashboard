import "server-only"

import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

import {
  actionClassForGate,
  isAllowedMutationPath,
} from "@/lib/auth/reauthentication-action-class"
import { normalizeReturnPath } from "@/lib/auth/reauthentication-return-path"
import { INVALID_CHALLENGE } from "@/lib/auth/reauthentication-result-codes"
import {
  CHALLENGE_COOKIE,
  PENDING_MUTATION_COOKIE,
  clearReauthenticationCookies,
  cookieOptions,
  formFieldsFrom,
  pendingFromForm,
  readPendingMutation,
  readStoredChallenge,
  serializePendingMutation,
  serializeStoredChallenge,
  type PendingMutation,
  MAX_AGE_SECONDS,
} from "@/lib/auth/reauthentication-state"
import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { resolveSafeRedirect } from "@/lib/security/request-origin"
import { canonicalRedirect } from "@/server/actions/redirects"
import { replayPendingMutation } from "@/server/actions/reauthentication-replay"

export { replayPendingMutation }

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

const pendingExpiry = (): number => Date.now() + MAX_AGE_SECONDS * 1000

export const reauthenticationResumePath = (returnPath: string): string => {
  const normalized = normalizeReturnPath(returnPath)
  const url = new URL(normalized, "https://console.local")
  url.searchParams.set("reauth", "required")
  return `${url.pathname}${url.search}`
}

export const storePendingMutation = async (
  response: NextResponse,
  pending: Omit<PendingMutation, "providerSessionId" | "expiresAt">,
  providerSessionId: string,
): Promise<void> => {
  const environment = readServerEnvironment()
  const envelope: PendingMutation = {
    ...pending,
    providerSessionId,
    expiresAt: pendingExpiry(),
  }
  response.cookies.set({
    name: PENDING_MUTATION_COOKIE,
    value: await serializePendingMutation(environment.csrfSigningKey, envelope),
    ...cookieOptions(),
  })
}

export const redirectForReauthentication = async (
  pending: Omit<PendingMutation, "providerSessionId" | "expiresAt">,
  providerSessionId: string,
  result?: string,
): Promise<NextResponse> => {
  let path = reauthenticationResumePath(pending.returnPath)
  if (result !== undefined && result !== "") {
    const url = new URL(path, "https://console.local")
    url.searchParams.set("result", result)
    path = `${url.pathname}${url.search}`
  }

  const response = NextResponse.redirect(canonicalRedirect(path), 303)
  response.headers.set("cache-control", NO_STORE)
  await storePendingMutation(response, pending, providerSessionId)
  return response
}

const sessionFromRequest = (request: NextRequest): ReturnType<typeof readSession> =>
  readSession(
    Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
    ),
  )

export const readPendingFromRequest = async (
  request: NextRequest,
): Promise<PendingMutation | undefined> => {
  const environment = readServerEnvironment()
  const outcome = sessionFromRequest(request)
  const providerSessionId =
    outcome.status === "active" ? outcome.session.providerSessionId : undefined

  return readPendingMutation(
    environment.csrfSigningKey,
    request.cookies.get(PENDING_MUTATION_COOKIE)?.value,
    providerSessionId === undefined ? { now: Date.now() } : { providerSessionId },
  )
}

export const readChallengeFromRequest = async (
  request: NextRequest,
): Promise<Awaited<ReturnType<typeof readStoredChallenge>> | undefined> => {
  const environment = readServerEnvironment()
  return readStoredChallenge(
    environment.csrfSigningKey,
    request.cookies.get(CHALLENGE_COOKIE)?.value,
  )
}

export const storeChallenge = async (
  response: NextResponse,
  challenge: Awaited<ReturnType<typeof readStoredChallenge>> & object,
): Promise<void> => {
  const environment = readServerEnvironment()
  response.cookies.set({
    name: CHALLENGE_COOKIE,
    value: await serializeStoredChallenge(environment.csrfSigningKey, challenge),
    ...cookieOptions(),
  })
}

export const clearReauthenticationState = (response: NextResponse): void => {
  for (const instruction of clearReauthenticationCookies()) {
    response.cookies.set(instruction)
  }
}

export const buildPendingFromForm = ({
  returnPath,
  mutationPath,
  gate,
  form,
  providerSessionId,
}: {
  returnPath: string
  mutationPath: string
  gate: PendingMutation["gate"]
  form: FormData
  providerSessionId: string
}): PendingMutation =>
  pendingFromForm({
    returnPath: normalizeReturnPath(returnPath),
    mutationPath,
    gate,
    actionClass: actionClassForGate(gate),
    form,
    providerSessionId,
    expiresAt: pendingExpiry(),
  })

export const validatePendingMutationPath = (
  gate: PendingMutation["gate"],
  mutationPath: string,
): boolean => isAllowedMutationPath(gate, mutationPath)

export const redirectBackForCeremony = async (
  request: NextRequest,
  result: string,
): Promise<NextResponse> => {
  const environment = readServerEnvironment()
  const token = request.cookies.get(PENDING_MUTATION_COOKIE)?.value
  const pending = await readPendingMutation(environment.csrfSigningKey, token, {
    now: Date.now(),
  })

  const path =
    pending === undefined
      ? "/"
      : (() => {
          const url = new URL(
            reauthenticationResumePath(pending.returnPath),
            "https://console.local",
          )
          url.searchParams.set("result", result)
          return `${url.pathname}${url.search}`
        })()

  const response = NextResponse.redirect(canonicalRedirect(path), 303)
  response.headers.set("cache-control", NO_STORE)

  if (result === INVALID_CHALLENGE) {
    response.cookies.set({
      name: CHALLENGE_COOKIE,
      value: "",
      ...cookieOptions(0),
      maxAge: 0,
    })
  }

  return response
}

export const safeRedirectLocation = (location: string): string | undefined => {
  const environment = readServerEnvironment()
  let parsed: URL
  try {
    parsed = location.startsWith("http")
      ? new URL(location)
      : new URL(location, environment.canonicalOrigin)
  } catch {
    return undefined
  }

  if (parsed.origin !== environment.canonicalOrigin) return undefined
  return resolveSafeRedirect(`${parsed.pathname}${parsed.search}`)
}

export const pendingReauthenticationContext = async (): Promise<
  | {
      readonly hasPending: true
      readonly gate: PendingMutation["gate"]
      readonly returnPath: string
    }
  | { readonly hasPending: false }
> => {
  const environment = readServerEnvironment()
  const jar = await cookies()
  const pending = await readPendingMutation(
    environment.csrfSigningKey,
    jar.get(PENDING_MUTATION_COOKIE)?.value,
    { now: Date.now() },
  )
  if (pending === undefined) return { hasPending: false }
  return {
    hasPending: true,
    gate: pending.gate,
    returnPath: pending.returnPath,
  }
}

export { formFieldsFrom }
