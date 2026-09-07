import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { extractAal } from "@/lib/auth/auth-provider"

import { repositoryRoot } from "../support/source-tree"

/**
 * The journey that turns a signed-in reader into one who can use the Console.
 *
 * An email code alone produces an `aal1` session, and the backend creates such
 * a session awaiting a second factor and refuses every read until one arrives.
 * Three separate gaps meant no reader could ever cross that line: the seed was
 * created and discarded, the challenge accepted only an already-verified
 * factor, and nothing activated the session afterwards.
 *
 * The pure module is exercised directly. The pages and route handlers need a
 * server environment they do not inject, so their wiring is read from source
 * following `auth-flow-feedback.test.ts`.
 */

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8")

const claims = (payload: Record<string, unknown>): string =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`

describe("the assurance level a routing decision may act on", () => {
  it("reads a second factor that the token proves", () => {
    expect(extractAal(claims({ aal: "aal2" }))).toBe("aal2")
  })

  it("reads a second factor that the token says is still owed", () => {
    expect(extractAal(claims({ aal: "aal1" }))).toBe("aal1")
  })

  it("reports absence as absence rather than as a missing factor", () => {
    // The one consumer sends a reader away on positive evidence. Folding an
    // absent claim into `aal1` would send every holder of a token that does
    // not carry one — including the stub principal the journeys run on — into
    // an enrolment they do not need.
    for (const token of [claims({}), claims({ aal: 7 }), "not-a-token", ""]) {
      expect(extractAal(token)).toBeUndefined()
    }
  })
})

describe("the seed is shown by the request that creates it", () => {
  const page = source("src/app/auth/mfa/enroll/page.tsx")

  it("renders the QR and the secret instead of discarding them", () => {
    // The route this replaces called the provider and threw the answer away,
    // so a reader could register a factor they had no way to hold.
    expect(page).toContain("enrollTotp")
    expect(page).toContain("qrCode={enrolment.value.qrCode}")
    expect(page).toContain("secret={enrolment.value.secret}")
  })

  it("clears an unconfirmed factor first, so a reload shows a seed that works", () => {
    expect(page).toContain("unenrollTotp")
    expect(page).toContain("factors.value.unverified")
  })

  it("never replaces an established factor from here", () => {
    expect(page).toContain("factors.value.verified.length > 0")
    expect(page).toContain('redirect("/auth/mfa/challenge")')
  })

  it("keeps the seed out of every store the page could reach", () => {
    expect(page).toContain('export const dynamic = "force-dynamic"')
    expect(page).toContain('export const fetchCache = "force-no-store"')
    expect(page).not.toContain("cookies().set")
    expect(page).not.toContain("searchParams")
  })
})

describe("a first factor can be confirmed", () => {
  const provider = source("src/lib/auth/auth-provider.ts")

  it("challenges an unverified factor when no verified one exists", () => {
    // Requiring a verified factor made the first challenge unreachable, so the
    // only way to own a verified factor was to already own one.
    expect(provider).toContain(
      'totp.find((candidate) => candidate.status === "verified") ?? totp[0]',
    )
  })
})

describe("the session is activated once the factor is proved", () => {
  const route = source("src/app/api/auth/mfa/challenge/route.ts")

  it("calls the activation the backend exposes for exactly this transition", () => {
    expect(route).toContain("activateSession")
  })

  it("activates with the upgraded token, not the one that opened the session", () => {
    expect(route).toContain("accessToken: verified.value.accessToken")
  })

  it("does not report a refused activation as a rejected code", () => {
    // The factor is confirmed either way. The Console reads its context next,
    // which either works or refuses with a reason of its own.
    expect(route).not.toContain("if (!activation.ok)")
  })
})

describe("a reader who still owes a factor is sent to finish it", () => {
  it("lands there from verification rather than on a Console that must fail", () => {
    expect(source("src/app/api/auth/verify-otp/route.ts")).toContain(
      'target === "/" ? "/auth/mfa/enroll" : target',
    )
  })

  it("is decided by the proxy, which already reads the session", () => {
    expect(source("src/proxy.ts")).toContain("extractAal(session.session.accessToken)")
  })
})
