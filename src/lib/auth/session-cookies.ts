import { COOKIE_BUDGET } from "./session-policy"

/**
 * Deterministic `__Host-` cookie chunking for the server-only session.
 *
 * Everything here fails closed. A malformed, colliding, gapped, duplicated,
 * reordered, corrupt, mixed-generation, excess or over-budget cookie state
 * produces a rejection plus the instruction to clear every bounded slot; it
 * never produces a partially reconstructed session, and it never authorizes a
 * refresh, bootstrap or domain effect.
 */

export const SESSION_COOKIE_BASE = "__Host-console-session"
export const PRE_AUTH_COOKIE_BASE = "__Host-console-pre-auth"

/** `__Host-` requires exactly these attributes: no Domain, and Path=/. */
export const COOKIE_ATTRIBUTES = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
} as const

export type CookieAttributes = typeof COOKIE_ATTRIBUTES

export type CookieInstruction = {
  readonly name: string
  readonly value: string
  readonly httpOnly: true
  readonly secure: true
  readonly sameSite: "lax"
  readonly path: "/"
  readonly maxAge: number
}

export type SessionCookieRejection =
  | "unchunked-and-chunked-collision"
  | "missing-chunk"
  | "duplicate-chunk"
  | "excess-chunks"
  | "stale-higher-chunk"
  | "mixed-generation"
  | "corrupt-chunk"
  | "malformed-payload"
  | "request-header-over-budget"

export type SessionCookieReadResult =
  | { readonly status: "absent" }
  | { readonly status: "valid"; readonly payload: string; readonly generation: string }
  | { readonly status: "rejected"; readonly reason: SessionCookieRejection }

export class CookieBudgetError extends Error {
  readonly reason = "response-header-over-budget"

  constructor(message: string) {
    super(message)
    this.name = "CookieBudgetError"
  }
}

const CHUNK_PREFIX_PATTERN =
  /^(?<generation>[A-Za-z0-9_-]{8})\.(?<index>\d)\.(?<total>\d)\./
const GENERATION_PATTERN = /^[A-Za-z0-9_-]{8}$/

const byteLength = (value: string): number => new TextEncoder().encode(value).length

export const createGeneration = (): string => {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
    .slice(0, 8)
}

export const chunkName = (base: string, index: number): string => `${base}.${index}`

/** Every slot the contract may ever occupy, so clearing is exhaustive. */
export const boundedSlotNames = (base: string): string[] => [
  base,
  ...Array.from({ length: COOKIE_BUDGET.chunkMaximum }, (_, index) =>
    chunkName(base, index),
  ),
]

/**
 * Split a payload across at most four `__Host-` chunks, refusing rather than
 * silently truncating when it does not fit.
 */
export const serializeSessionCookies = (
  base: string,
  payload: string,
  generation: string,
  maxAgeSeconds: number,
): CookieInstruction[] => {
  if (!GENERATION_PATTERN.test(generation)) {
    throw new CookieBudgetError("session cookie generation is malformed")
  }

  const chunks: string[] = []
  let cursor = 0
  // The prefix is part of the value, so capacity is measured with it present.
  const total = COOKIE_BUDGET.chunkMaximum

  for (let index = 0; index < total; index += 1) {
    const prefix = `${generation}.${index}.${total}.`
    const capacity = COOKIE_BUDGET.chunkValueBytes - byteLength(prefix)
    if (capacity <= 0) {
      throw new CookieBudgetError("chunk prefix exceeds the frozen chunk budget")
    }
    chunks.push(prefix + payload.slice(cursor, cursor + capacity))
    cursor += capacity
  }

  if (cursor < payload.length) {
    throw new CookieBudgetError(
      `session exceeds the frozen cookie budget of ${COOKIE_BUDGET.chunkMaximum} chunks`,
    )
  }

  const instructions: CookieInstruction[] = chunks.map((value, index) => ({
    name: chunkName(base, index),
    value,
    ...COOKIE_ATTRIBUTES,
    maxAge: maxAgeSeconds,
  }))

  assertResponseHeaderBudget(instructions)
  // The aggregate inbound budget binds before the per-chunk budget: four full
  // 3072-byte chunks are 12288 bytes, which no 8192-byte Cookie header can
  // carry back. Writing such a session would lock the principal out on the
  // very next request, so it is refused at write time instead.
  assertRequestHeaderBudget(instructions)
  return instructions
}

/** The largest payload that can survive a round trip within both budgets. */
export const maximumPayloadBytes = (base: string): number => {
  const perChunkOverhead = Array.from(
    { length: COOKIE_BUDGET.chunkMaximum },
    (_, index) =>
      byteLength(`${chunkName(base, index)}=${"g".repeat(8)}.${index}.4.; `),
  ).reduce((sum, size) => sum + size, 0)
  return COOKIE_BUDGET.requestHeaderBytes - perChunkOverhead
}

/** Clear every bounded slot, including ones a previous generation used. */
export const clearSessionCookies = (base: string): CookieInstruction[] =>
  boundedSlotNames(base).map((name) => ({
    name,
    value: "",
    ...COOKIE_ATTRIBUTES,
    maxAge: 0,
  }))

const serializedSetCookieLength = (instruction: CookieInstruction): number =>
  byteLength(
    `${instruction.name}=${instruction.value}; Max-Age=${instruction.maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  )

export const assertResponseHeaderBudget = (instructions: CookieInstruction[]): void => {
  const total = instructions.reduce(
    (sum, instruction) => sum + serializedSetCookieLength(instruction),
    0,
  )
  if (total > COOKIE_BUDGET.responseHeaderBytes) {
    throw new CookieBudgetError(
      `Set-Cookie total ${total} exceeds the frozen ${COOKIE_BUDGET.responseHeaderBytes} bytes`,
    )
  }
}

export const requestHeaderBytes = (cookies: Record<string, string>): number =>
  Object.entries(cookies).reduce(
    (sum, [name, value]) => sum + byteLength(`${name}=${value}; `),
    0,
  )

export const assertRequestHeaderBudget = (instructions: CookieInstruction[]): void => {
  const total = requestHeaderBytes(
    Object.fromEntries(instructions.map(({ name, value }) => [name, value])),
  )
  if (total > COOKIE_BUDGET.requestHeaderBytes) {
    throw new CookieBudgetError(
      `Cookie total ${total} exceeds the frozen ${COOKIE_BUDGET.requestHeaderBytes} bytes`,
    )
  }
}

const rejected = (reason: SessionCookieRejection): SessionCookieReadResult => ({
  status: "rejected",
  reason,
})

/**
 * Reassemble the payload, or refuse. The caller must clear every bounded slot
 * on any rejection and perform no Auth, bootstrap or domain effect.
 */
export const parseSessionCookies = (
  base: string,
  cookies: Record<string, string>,
): SessionCookieReadResult => {
  if (requestHeaderBytes(cookies) > COOKIE_BUDGET.requestHeaderBytes) {
    return rejected("request-header-over-budget")
  }

  const unchunked = cookies[base]
  const present = new Map<number, string>()
  const seen = new Set<number>()

  for (const [name, value] of Object.entries(cookies)) {
    if (!name.startsWith(`${base}.`)) continue

    const suffix = name.slice(base.length + 1)
    if (!/^\d+$/.test(suffix)) return rejected("corrupt-chunk")

    const index = Number(suffix)
    if (index >= COOKIE_BUDGET.chunkMaximum) return rejected("excess-chunks")
    if (seen.has(index)) return rejected("duplicate-chunk")
    seen.add(index)
    present.set(index, value)
  }

  if (present.size === 0) {
    return unchunked === undefined ? { status: "absent" } : rejected("corrupt-chunk")
  }

  // A leftover unchunked cookie beside chunks is ambiguous: an attacker could
  // otherwise pin an old single-cookie session next to a fresh chunked one.
  if (unchunked !== undefined) return rejected("unchunked-and-chunked-collision")

  const parsed: { index: number; total: number; generation: string; body: string }[] =
    []
  for (const [index, value] of present) {
    const match = CHUNK_PREFIX_PATTERN.exec(value)
    if (!match?.groups) return rejected("corrupt-chunk")

    const declaredIndex = Number(match.groups["index"])
    const total = Number(match.groups["total"])
    const generation = match.groups["generation"] as string

    // The cookie name and the signed-in position must agree, so a reordered
    // set cannot reassemble into a different payload.
    if (declaredIndex !== index) return rejected("corrupt-chunk")
    if (total < 1 || total > COOKIE_BUDGET.chunkMaximum)
      return rejected("corrupt-chunk")

    parsed.push({ index, total, generation, body: value.slice(match[0].length) })
  }

  const generations = new Set(parsed.map((chunk) => chunk.generation))
  if (generations.size > 1) return rejected("mixed-generation")

  const totals = new Set(parsed.map((chunk) => chunk.total))
  if (totals.size > 1) return rejected("mixed-generation")

  const total = parsed[0]?.total ?? 0
  if (parsed.length > total) return rejected("stale-higher-chunk")
  if (parsed.length < total) return rejected("missing-chunk")

  for (let index = 0; index < total; index += 1) {
    if (!present.has(index)) return rejected("missing-chunk")
  }

  const payload = parsed
    .toSorted((left, right) => left.index - right.index)
    .map((chunk) => chunk.body)
    .join("")

  if (payload.length === 0) return rejected("malformed-payload")

  return {
    status: "valid",
    payload,
    generation: parsed[0]?.generation as string,
  }
}
