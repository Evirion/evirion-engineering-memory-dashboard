import { describe, expect, it } from "vitest"

import {
  readInstallationReturn,
  safeInstallationId,
} from "@/lib/repositories/github-installation-return"

const STATE = "ab".repeat(32)

const query = (entries: Record<string, string>): URLSearchParams =>
  new URLSearchParams({
    setup_action: "install",
    state: STATE,
    installation_id: "991001",
    ...entries,
  })

describe("reading the GitHub installation return", () => {
  it("accepts the shape GitHub sends after a fresh install", () => {
    expect(readInstallationReturn(query({}))).toEqual({
      state: STATE,
      providerInstallationId: 991001,
    })
  })

  it("refuses every setup action other than a fresh install", () => {
    for (const setup_action of ["update", "request", "", "INSTALL"]) {
      expect(readInstallationReturn(query({ setup_action }))).toBeNull()
    }
  })

  it("refuses a state that is not a setup-intent nonce", () => {
    for (const state of ["", "not-a-state", STATE.toUpperCase(), `${STATE}0`]) {
      expect(readInstallationReturn(query({ state }))).toBeNull()
    }
  })

  it("refuses an identifier that cannot round-trip through a number", () => {
    // The digit pattern allows eighteen digits, which is past
    // Number.MAX_SAFE_INTEGER. Converting silently would name a different
    // installation than the one the reader installed.
    expect(safeInstallationId("9007199254740993")).toBeNull()
    expect(safeInstallationId("999999999999999999")).toBeNull()
    expect(
      readInstallationReturn(query({ installation_id: "9007199254740993" })),
    ).toBeNull()
  })

  it("accepts the largest identifier that still round-trips", () => {
    expect(safeInstallationId(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    )
  })

  it("refuses a malformed or absent identifier", () => {
    for (const installation_id of ["", "0", "-1", "1e9", "0991001", " 991001"]) {
      expect(readInstallationReturn(query({ installation_id }))).toBeNull()
    }
  })
})
