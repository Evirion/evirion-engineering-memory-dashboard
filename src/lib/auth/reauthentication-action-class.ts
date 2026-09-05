/**
 * Action classes the backend binds to a step-up challenge.
 *
 * Freshness is session-wide after a challenge is consumed, but the class must
 * stay consistent between issue and complete. Imports are gated on freshness
 * like every other dangerous mutation; the contract publishes no import-
 * specific class, so they use `membership_change`, the org-scoped class the
 * backend already carried before `knowledge_lifecycle` was added.
 */

export const REAUTHENTICATION_ACTION_CLASSES = [
  "membership_change",
  "factor_change",
  "email_change",
  "account_recovery",
  "knowledge_lifecycle",
] as const

export type ReauthenticationActionClass =
  (typeof REAUTHENTICATION_ACTION_CLASSES)[number]

/** Surfaces that share one step-up mechanism. EEM-9/06 wires `membership`. */
export type ReauthenticationGate =
  "repository_import" | "knowledge_lifecycle" | "membership_change"

export const actionClassForGate = (
  gate: ReauthenticationGate,
): ReauthenticationActionClass => {
  switch (gate) {
    case "repository_import":
      return "membership_change"
    case "knowledge_lifecycle":
      return "knowledge_lifecycle"
    case "membership_change":
      return "membership_change"
    default: {
      const exhaustive: never = gate
      throw new Error(`unhandled reauthentication gate: ${String(exhaustive)}`)
    }
  }
}

export const isReauthenticationActionClass = (
  value: string,
): value is ReauthenticationActionClass =>
  (REAUTHENTICATION_ACTION_CLASSES as readonly string[]).includes(value)

/** Mutation paths the BFF may replay for each gate. Client input is checked here. */
export const MUTATION_PATHS_FOR_GATE: Readonly<
  Record<ReauthenticationGate, readonly string[]>
> = {
  repository_import: [
    "/api/imports/prepare",
    "/api/imports/approve",
    "/api/imports/state",
    "/api/imports/retry",
  ],
  knowledge_lifecycle: [
    "/api/memory/activate",
    "/api/memory/supersede",
    "/api/memory/corrections",
  ],
  membership_change: [
    "/api/settings/invitations/create",
    "/api/settings/invitations/resend",
    "/api/settings/invitations/revoke",
    "/api/settings/members/update",
    "/api/settings/offboarding/request",
  ],
}

export const isAllowedMutationPath = (
  gate: ReauthenticationGate,
  mutationPath: string,
): boolean => MUTATION_PATHS_FOR_GATE[gate].includes(mutationPath)
