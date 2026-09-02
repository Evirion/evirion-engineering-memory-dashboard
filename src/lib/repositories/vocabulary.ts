/**
 * The four things a customer keeps confusing, kept apart.
 *
 * Source work, customer consent, Evirion operational authorization and paid
 * execution are four distinct gates. Conflating any two of them is how a
 * customer comes to believe that turning something on has authorized a paid
 * call, so every policy surface states all four separately.
 *
 * The wording is neutral text derived from the accepted requirements, not
 * approved product copy. Open decision 3 owns the customer-facing wording; it
 * is recorded in `docs/architecture/console-ui-conventions.md` and the
 * EEM-9/03 acceptance trace. The tests assert that the four remain separate
 * and distinctly labelled, not that they carry these exact words, so approved
 * copy can land without invalidating an acceptance row.
 */

export type PolicyTermId =
  "source-work" | "customer-consent" | "operational-authorization" | "paid-execution"

export type PolicyTerm = {
  readonly id: PolicyTermId
  readonly term: string
  readonly meaning: string
  /** Who has to act for this gate to open. */
  readonly heldBy: "you" | "evirion"
}

export const POLICY_TERMS: readonly PolicyTerm[] = [
  {
    id: "source-work",
    term: "Source work",
    meaning:
      "Evirion prepares a merged pull request for later analysis. No model is called and nothing is charged.",
    heldBy: "you",
  },
  {
    id: "customer-consent",
    term: "Your consent",
    meaning:
      "You record a standing permission for this repository, bounded by model profiles, a call ceiling, a budget ceiling, a retry policy and an expiry.",
    heldBy: "you",
  },
  {
    id: "operational-authorization",
    term: "Evirion authorization",
    meaning:
      "Evirion separately authorizes the work on its side. Your consent never grants this, and there is nothing for you to do here.",
    heldBy: "evirion",
  },
  {
    id: "paid-execution",
    term: "Paid execution",
    meaning:
      "A model is actually called. It happens only when the entitlement, the policy, your consent and Evirion authorization are all in place.",
    heldBy: "evirion",
  },
]

export const policyTerm = (id: PolicyTermId): PolicyTerm => {
  const found = POLICY_TERMS.find((term) => term.id === id)
  if (!found) throw new Error(`unknown policy term: ${id}`)
  return found
}
