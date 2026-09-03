import type { KnowledgeReceipt } from "@contracts/console"

import {
  CommandOutcomeNotice,
  readCommandResult,
} from "@/components/repositories/command-outcome"

/**
 * What happened to the knowledge command the customer just sent.
 *
 * None of the four knowledge response codes is a published error code. The
 * shared reader knows the thirty-nine published codes and the word `applied`,
 * and nothing else, so routing a receipt code through it would fail closed and
 * tell the customer the outcome is unknown for a command that committed and
 * changed state. EEM-9/04 shipped exactly that defect on its own receipt.
 *
 * The codes are handled here rather than there because the shared reader is
 * EEM-9/03's and this is the only surface that can produce them.
 *
 * Each notice states what changed and, where two axes could be confused, what
 * did not. Recording a review does not activate anything, and activating does
 * not close a review.
 */

type ResponseCode = KnowledgeReceipt["responseCode"]

/**
 * Typed against the receipt rather than written as bare strings, so a contract
 * that renames or drops one of these fails the typecheck instead of silently
 * sending a committed command home as an unknown outcome again.
 */
const REVIEW_RECORDED: ResponseCode = "KNOWLEDGE_REVIEW_RECORDED"
const MARKED_ACTIVE: ResponseCode = "KNOWLEDGE_MARKED_ACTIVE"
const MARKED_SUPERSEDED: ResponseCode = "KNOWLEDGE_MARKED_SUPERSEDED"
const CORRECTION_REQUESTED: ResponseCode = "KNOWLEDGE_CORRECTION_REQUESTED"

export const KNOWLEDGE_RESPONSE_CODES: readonly ResponseCode[] = [
  REVIEW_RECORDED,
  MARKED_ACTIVE,
  MARKED_SUPERSEDED,
  CORRECTION_REQUESTED,
]

const COMMITTED: Readonly<Record<string, { headline: string; detail: string }>> = {
  [REVIEW_RECORDED]: {
    headline: "Your review is recorded.",
    detail:
      "The decision is appended to this object's history. It does not change the lifecycle: the object is only active once it is marked active.",
  },
  [MARKED_ACTIVE]: {
    headline: "This Knowledge Object is now active.",
    detail:
      "Retrieval can return it. Its review history is unchanged and can still be added to.",
  },
  [MARKED_SUPERSEDED]: {
    headline: "This Knowledge Object is now superseded.",
    detail:
      "The newer object replaces it. The newer one is not activated by this: that is a separate decision.",
  },
  [CORRECTION_REQUESTED]: {
    headline: "Your correction request is with Evirion.",
    detail:
      "Nothing has changed yet. An Evirion operator applies or declines the request, and its status appears below.",
  },
}

export const KnowledgeOutcomeNotice = ({ result }: { result: string | undefined }) => {
  const committed = result === undefined ? undefined : COMMITTED[result]

  if (committed) {
    return (
      <output
        aria-live="polite"
        data-testid={`knowledge-outcome-${result}`}
        className="flex flex-col gap-1 rounded border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900"
      >
        <span>{committed.headline}</span>
        <span className="text-xs">{committed.detail}</span>
      </output>
    )
  }

  const outcome = readCommandResult(result)
  return outcome ? <CommandOutcomeNotice result={outcome} /> : null
}
