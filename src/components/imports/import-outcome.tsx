import {
  CommandOutcomeNotice,
  readCommandResult,
} from "@/components/repositories/command-outcome"

/**
 * What happened to the import command the customer just sent.
 *
 * One import outcome is neither a plain success nor a published error code.
 * When source dead-letter work remains, the backend answers a resume by forcing
 * the run back to `PAUSED` and returning its own receipt response code. That is
 * a completed command: state changed and the page below has re-read it.
 *
 * The shared reader knows the thirty-nine published error codes and the word
 * `applied`, and nothing else, so routing a receipt code through it would fail
 * closed and tell the customer the outcome is unknown when it is not. It is
 * handled here rather than there because the shared reader is EEM-9/03's and
 * this is the only surface that can produce the code.
 */
export const RESUME_BLOCKED = "REPOSITORY_IMPORT_RESUME_BLOCKED"

export const ImportOutcomeNotice = ({ result }: { result: string | undefined }) => {
  if (result === RESUME_BLOCKED) {
    return (
      <output
        aria-live="polite"
        data-testid="import-outcome-resume-blocked"
        className="flex flex-col gap-1 rounded border border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-900"
      >
        <span>
          Resume was applied, and the backend kept this import paused because source
          work is still held back.
        </span>
        <span className="text-xs">
          Recover the failed work below, then resume again.
        </span>
      </output>
    )
  }

  const outcome = readCommandResult(result)
  return outcome ? <CommandOutcomeNotice result={outcome} /> : null
}
