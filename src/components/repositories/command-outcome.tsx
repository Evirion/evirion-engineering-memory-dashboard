import { describeTreatment, treatmentForCode } from "@/lib/errors/console-errors"

/**
 * What happened to the command the customer just sent.
 *
 * Success is only ever reported for a committed receipt, and the page that
 * shows it has already re-read the repository, so what is beside this notice
 * is the committed projection rather than an optimistic guess.
 *
 * A refusal reports the published stable code and the reviewed treatment for
 * it. It deliberately makes no retryability claim: that belongs to the backend
 * payload that produced it, and this page is a later request that never saw it.
 */
export type CommandResult =
  | { readonly kind: "applied" }
  | { readonly kind: "refused"; readonly code: string; readonly explanation: string }
  | { readonly kind: "unknown"; readonly code: string }

export const readCommandResult = (
  raw: string | undefined,
): CommandResult | undefined => {
  if (raw === undefined || raw === "") return undefined
  if (raw === "applied") return { kind: "applied" }

  const treatment = treatmentForCode(raw)
  // An unpublished code fails closed rather than being echoed as if it meant
  // something. It also stops a crafted URL from printing arbitrary text.
  return treatment === undefined
    ? { kind: "unknown", code: "UNSUPPORTED_SERVER_RESPONSE" }
    : { kind: "refused", code: raw, explanation: describeTreatment(treatment) }
}

export const CommandOutcomeNotice = ({ result }: { result: CommandResult }) => {
  if (result.kind === "applied") {
    return (
      <output
        aria-live="polite"
        className="rounded border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900"
      >
        Done. The state below is what the backend has committed.
      </output>
    )
  }

  if (result.kind === "unknown") {
    return (
      <output
        aria-live="polite"
        className="rounded border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900"
      >
        {describeTreatment("unknown-outcome")}
      </output>
    )
  }

  return (
    <output
      aria-live="polite"
      className="flex flex-col gap-1 rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <span>{result.explanation}</span>
      <span className="text-xs">
        Reason <code>{result.code}</code>
      </span>
    </output>
  )
}
