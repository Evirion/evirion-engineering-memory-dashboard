/**
 * Does the double tell the same story as the backend?
 *
 * Every Console surface through EEM-9/06 was verified against the double, and
 * the double was written from the contract while the backend implements the
 * same contract. Nothing had ever checked that the two readings agree.
 *
 * The checks here need no backend, because the interesting divergence turned
 * out to be static: a refusal the double cannot produce is a refusal no test
 * can exercise, however many tests there are. One live check is included and
 * opts in through CONSOLE_LIVE_BACKEND_URL.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

import {
  isConsoleError,
  isGithubSettingsSummary,
  isOrganizationInvitations,
  isOrganizationMetrics,
  isOrganizationModelProfiles,
  isOrganizationOffboardingStatus,
  isOrganizationUsage,
  isProcessingPage,
  isPullRequestDetail,
  isRepositoryImportFailures,
  isValidationIssues,
} from "@contracts/console"

import { ERRORS, MESSAGES } from "../../tools/console-stub/errors.mjs"
import {
  GITHUB_SETTINGS_SUMMARY,
  IMPORT_FAILURES,
  MODEL_PROFILES,
  OFFBOARDING_STATUS,
  ORGANIZATION_INVITATIONS,
  ORGANIZATION_METRICS,
  ORGANIZATION_USAGE,
  PROCESSING_PAGE,
  PULL_REQUEST_DETAIL,
  VALIDATION_ISSUES,
} from "../../tools/console-stub/fixtures.mjs"
import { liveBackendUrl, requireLiveBackend } from "../support/live-backend"

/**
 * `error.json` is shared by the Console and operator contracts, so the
 * generated union carries two codes no Console surface can receive. The double
 * is right not to implement them, and this list is why.
 */
const OPERATOR_ONLY_CODES = [
  "BACKFILL_NOT_APPROVABLE",
  "NEW_MODEL_CALL_NOT_AUTHORIZED",
] as const

const validatorSource = readFileSync(
  fileURLToPath(
    new URL("../../generated/console-contract/v1/validators.ts", import.meta.url),
  ),
  "utf8",
)

/** The published vocabulary, read from the generated validator that enforces it. */
const publishedErrorCodes = (): readonly string[] => {
  const start = validatorSource.indexOf("export function isConsoleError")
  if (start < 0) return []
  const guard = validatorSource.slice(start, validatorSource.indexOf("\n}", start))
  const codes = guard
    .match(/"([A-Z][A-Z0-9_]{3,})"/g)
    ?.map((value) => value.slice(1, -1))
  return [...new Set(codes ?? [])]
}

const envelopeFor = (code: string): unknown => ({
  contractVersion: "1.0",
  error: {
    code,
    message: MESSAGES[code] ?? "The request was refused.",
    retryable: ERRORS[code]?.[1] ?? false,
  },
  requestId: "00000000-0000-4000-8000-00000000000a",
})

describe("published error vocabulary", () => {
  test("the generated validator is the source and it is not empty", () => {
    expect(publishedErrorCodes().length).toBeGreaterThanOrEqual(40)
  })

  test("the double can produce every refusal a Console surface can receive", () => {
    const reachable = publishedErrorCodes().filter(
      (code) =>
        !OPERATOR_ONLY_CODES.includes(code as (typeof OPERATOR_ONLY_CODES)[number]),
    )
    const missing = reachable.filter((code) => !(code in ERRORS)).toSorted()
    expect(missing).toEqual([])
  })

  test("the double claims no code the contract does not publish", () => {
    const published = new Set(publishedErrorCodes())
    expect(
      Object.keys(ERRORS)
        .filter((code) => !published.has(code))
        .toSorted(),
    ).toEqual([])
  })

  test("operator-only codes stay out of the double", () => {
    for (const code of OPERATOR_ONLY_CODES) expect(code in ERRORS).toBe(false)
  })

  test("every refusal the double produces satisfies the generated validator", () => {
    for (const code of Object.keys(ERRORS)) {
      expect(
        isConsoleError(envelopeFor(code)),
        `${code} is not a valid ConsoleError`,
      ).toBe(true)
    }
  })

  test("a rate limit is the one refusal a caller should retry", () => {
    expect(ERRORS.RATE_LIMITED).toEqual([429, true])
    const retryable = Object.entries(ERRORS)
      .filter(([, definition]) => definition[1])
      .map(([code]) => code)
      .toSorted()
    // GITHUB_SYNC_INCOMPLETE and DEPENDENCY_UNAVAILABLE were already retryable;
    // this pins the set so a new one cannot appear unnoticed.
    expect(retryable).toEqual([
      "DEPENDENCY_UNAVAILABLE",
      "GITHUB_SYNC_INCOMPLETE",
      "RATE_LIMITED",
    ])
  })
})

describe("double fixtures against the generated validators", () => {
  const documents: readonly [string, unknown, (value: unknown) => boolean][] = [
    ["GITHUB_SETTINGS_SUMMARY", GITHUB_SETTINGS_SUMMARY(), isGithubSettingsSummary],
    ["MODEL_PROFILES", MODEL_PROFILES(), isOrganizationModelProfiles],
    ["OFFBOARDING_STATUS", OFFBOARDING_STATUS(), isOrganizationOffboardingStatus],
    ["ORGANIZATION_INVITATIONS", ORGANIZATION_INVITATIONS(), isOrganizationInvitations],
    ["ORGANIZATION_METRICS", ORGANIZATION_METRICS(), isOrganizationMetrics],
    ["ORGANIZATION_USAGE", ORGANIZATION_USAGE(), isOrganizationUsage],
    ["PROCESSING_PAGE", PROCESSING_PAGE(), isProcessingPage],
    ["PULL_REQUEST_DETAIL", PULL_REQUEST_DETAIL(), isPullRequestDetail],
    ["VALIDATION_ISSUES", VALIDATION_ISSUES(), isValidationIssues],
  ]

  test.each(documents)(
    "%s satisfies its contract type",
    (_name, document, validate) => {
      expect(validate(document)).toBe(true)
    },
  )

  test("every import's failure document satisfies its contract type", () => {
    // The fixture is keyed by import so one double can serve several; the
    // contract document is one import's failures plus its identifier.
    const byImport = IMPORT_FAILURES() as Record<string, readonly unknown[]>
    const imports = Object.entries(byImport)
    expect(imports.length).toBeGreaterThan(0)
    for (const [importId, failures] of imports) {
      expect(
        isRepositoryImportFailures({ failures, importId }),
        `${importId} does not satisfy RepositoryImportFailures`,
      ).toBe(true)
    }
  })
})

describe("live backend", () => {
  test("the tier refuses to skip when no backend is configured", () => {
    if (liveBackendUrl() === undefined) {
      expect(() => requireLiveBackend()).toThrow(/never skips/)
      return
    }
    expect(requireLiveBackend().baseUrl).toMatch(/^https?:\/\//)
  })

  test("an unauthenticated caller is refused identically by both", async () => {
    const baseUrl = liveBackendUrl()
    if (baseUrl === undefined) return

    const response = await fetch(
      `${baseUrl}/v1/organizations/00000000-0000-4000-8000-0000000000a1/repositories`,
    )
    const body: unknown = await response.json()

    expect(response.status).toBe(401)
    expect(isConsoleError(body)).toBe(true)
    const error = (body as { error: { code: string; retryable: boolean } }).error
    // The double's own table is the comparison: if the backend refuses with a
    // different status or retryability, the two readings have diverged.
    const expected = ERRORS.AUTHENTICATION_REQUIRED
    expect(expected).toBeDefined()
    expect([error.code, response.status, error.retryable]).toEqual([
      "AUTHENTICATION_REQUIRED",
      expected?.[0],
      expected?.[1],
    ])
  })
})
