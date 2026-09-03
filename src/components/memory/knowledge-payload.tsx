import type { KnowledgeDetail } from "@contracts/console"

import { type EditedDerivative, editedDerivativeOf } from "@/lib/knowledge/presentation"

/**
 * The machine extraction and the reviewer's derivative, side by side.
 *
 * An edit is a derivative, not a replacement. `originalPayload` remains the
 * machine extraction whatever a reviewer later did, so both stay reachable on
 * this screen: the original is never overwritten, never hidden behind a
 * destructive action, and never presented as a previous version to discard.
 *
 * Whether this reads as two columns, a diff or a toggle is open decision 4 and
 * the design TODO in the conventions. The structure below is what the contract
 * fixes either way: two separately named regions, the original always present,
 * and the derivative labelled as the reviewer's.
 *
 * Only a field the payload actually carries is rendered. `KD-001` forbids
 * invented empty sections, so an absent or empty value produces no heading.
 */

/** The thirteen editable keys, in the order `REV-002` lists them. */
const FIELDS = [
  ["knowledgeType", "Knowledge type"],
  ["problem", "Problem"],
  ["knowledge", "Knowledge"],
  ["designRationale", "Design rationale"],
  ["documentedTradeoffs", "Documented trade-offs"],
  ["explicitAlternatives", "Explicit alternatives"],
  ["constraints", "Constraints"],
  ["invariants", "Invariants"],
  ["failureModes", "Failure modes"],
  ["affectedSystems", "Affected systems"],
  ["futureImpact", "Future impact"],
  ["answerableQuestions", "Answerable questions"],
  ["implementationStatus", "Implementation status"],
] as const

type Rendered = { readonly label: string; readonly values: readonly string[] }

/**
 * The fields worth showing, in contract order.
 *
 * Anything outside the published editable projection is skipped rather than
 * printed. A payload carrying an unexpected key is not a reason to render
 * whatever it holds.
 */
const renderable = (payload: Record<string, unknown>): readonly Rendered[] =>
  FIELDS.flatMap(([key, label]) => {
    const value = payload[key]
    if (typeof value === "string" && value.trim() !== "") {
      return [{ label, values: [value] }]
    }
    if (Array.isArray(value)) {
      const entries = value.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim() !== "",
      )
      return entries.length === 0 ? [] : [{ label, values: entries }]
    }
    return []
  })

const PayloadFields = ({ payload }: { payload: Record<string, unknown> }) => {
  const fields = renderable(payload)
  if (fields.length === 0) {
    return (
      <p className="text-sm text-slate-700">
        This payload carries no field the contract publishes as editable.
      </p>
    )
  }

  return (
    <dl className="flex flex-col gap-3">
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {field.label}
          </dt>
          {field.values.length === 1 ? (
            <dd className="text-sm whitespace-pre-line text-slate-900">
              {field.values[0]}
            </dd>
          ) : (
            <dd>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-slate-900">
                {field.values.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}

const DerivativePanel = ({ derivative }: { derivative: EditedDerivative }) => (
  <section
    aria-label="Reviewer's edited derivative"
    data-testid="knowledge-edited"
    className="flex flex-col gap-3 rounded border border-amber-400 bg-amber-50 px-4 py-3"
  >
    <div className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-slate-900">
        Reviewer's edited derivative
      </h2>
      <p className="text-xs text-slate-700">
        A reviewer restated this claim at review sequence {derivative.reviewSequence} on{" "}
        {derivative.recordedAt.slice(0, 10)}. It sits beside the machine extraction
        rather than replacing it.
      </p>
      {/* The evidence is the original machine evidence. An edited claim was
          not re-extracted, and saying so is a `REV-002` acceptance row. */}
      <p className="text-xs font-medium text-amber-900">
        The evidence below supports the machine extraction. These edited words were
        written by a reviewer and were not re-extracted from the source.
      </p>
    </div>
    <PayloadFields payload={derivative.payload} />
  </section>
)

export const KnowledgePayloads = ({ detail }: { detail: KnowledgeDetail }) => {
  const derivative = editedDerivativeOf(detail)

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <section
        aria-label="Machine extraction"
        data-testid="knowledge-original"
        className="flex flex-1 flex-col gap-3 rounded border border-slate-300 bg-white px-4 py-3"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-slate-900">Machine extraction</h2>
          <p className="text-xs text-slate-700">
            {/* Stated whether or not an edit exists, so the original never
                reads as a superseded draft. */}
            The original extraction. It is kept whatever a reviewer decides and is never
            overwritten.
          </p>
        </div>
        <PayloadFields payload={detail.originalPayload} />
      </section>

      {derivative === null ? null : (
        <div className="flex-1">
          <DerivativePanel derivative={derivative} />
        </div>
      )}
    </div>
  )
}
