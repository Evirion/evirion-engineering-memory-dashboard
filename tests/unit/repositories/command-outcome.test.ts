import { describe, expect, it } from "vitest"

import { readCommandResult } from "@/components/repositories/command-outcome"
import { treatmentForCode } from "@/lib/errors/console-errors"

/**
 * EEM-9/03 C03-5.
 *
 * A mutation answers with a redirect, so the page reporting the outcome sees
 * the stable code without the payload that carried it. What it may say about
 * that code is bounded here: the reviewed treatment, and nothing about
 * retryability, which belongs to the response this page never saw.
 */

describe("reading a command outcome", () => {
  it("reports nothing when no command was sent", () => {
    expect(readCommandResult(undefined)).toBeUndefined()
    expect(readCommandResult("")).toBeUndefined()
  })

  it("reports a committed receipt as applied", () => {
    expect(readCommandResult("applied")).toEqual({ kind: "applied" })
  })

  it.each([
    "VERSION_CONFLICT",
    "REPOSITORY_LIMIT_REACHED",
    "REPOSITORY_REPLACEMENT_REQUIRES_OPERATOR",
    "ENTITLEMENT_GENERATION_STALE",
    "REPOSITORY_ACCESS_CHANGED",
    "IDEMPOTENCY_KEY_REUSED",
    "ORGANIZATION_LIMIT_NOT_PROVISIONED",
    "CAPABILITY_REQUIRED",
    "REQUEST_INVALID",
  ])("explains the published code %s", (code) => {
    const result = readCommandResult(code)

    expect(result).toMatchObject({ kind: "refused", code })
    expect(result).not.toHaveProperty("retryable")
  })

  it("fails closed on a code the contract never published", () => {
    // Also stops a crafted URL from printing arbitrary text on the page.
    expect(readCommandResult("TOTALLY_MADE_UP")).toEqual({
      kind: "unknown",
      code: "UNSUPPORTED_SERVER_RESPONSE",
    })
    expect(readCommandResult("<script>alert(1)</script>")).toEqual({
      kind: "unknown",
      code: "UNSUPPORTED_SERVER_RESPONSE",
    })
  })

  it("never invents a treatment for an unpublished code", () => {
    expect(treatmentForCode("TOTALLY_MADE_UP")).toBeUndefined()
    expect(treatmentForCode("VERSION_CONFLICT")).toBe("reload-and-resubmit")
  })
})
