import type { KnowledgeDetail } from "@contracts/console"

import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { lifecycleStateLabel, reviewDecisionLabel } from "@/lib/knowledge/presentation"
import type { KnowledgeEvidenceView } from "@/server/queries/knowledge"

/**
 * One Knowledge Object's context, evidence and technical detail.
 *
 * Three separations the contract fixes and this file holds:
 *
 * - review and lifecycle are two axes and are labelled as two;
 * - the evidence is visible before any review control, because `KD-002`
 *   requires the attribution to be readable before a decision is made;
 * - the technical block is customer-safe by construction. The raw model
 *   response, the Source Envelope body and every credential are absent from
 *   the projection, so there is nothing here to filter out.
 */

const fact = "flex flex-col gap-1"
const term = "text-xs font-medium tracking-wide text-slate-500 uppercase"
const value = "text-sm text-slate-900"

export const KnowledgeStates = ({ detail }: { detail: KnowledgeDetail }) => (
  <section
    aria-label="Review and lifecycle"
    data-testid="knowledge-states"
    className="rounded border border-slate-300 bg-white px-4 py-3"
  >
    <dl className="grid gap-4 sm:grid-cols-3">
      <div className={fact}>
        <dt className={term}>Human review</dt>
        {/* Sequence zero is the absence of a review, which is pending rather
            than unknown. */}
        <dd className={value}>{reviewDecisionLabel(detail.lifecycle.decision)}</dd>
      </div>
      <div className={fact}>
        <dt className={term}>Lifecycle</dt>
        <dd className={value}>
          {lifecycleStateLabel(detail.lifecycle.lifecycleState)}
        </dd>
      </div>
      <div className={fact}>
        <dt className={term}>In trusted memory</dt>
        <dd className={value}>
          {detail.lifecycle.inActiveProjection
            ? "Yes, retrieval can return this"
            : "No, retrieval cannot return this"}
        </dd>
      </div>
    </dl>
    <p className="mt-3 text-xs text-slate-600">
      Reviewing a Knowledge Object does not activate it, and activating one does not
      close its review.
    </p>
  </section>
)

export const KnowledgeSourceContext = ({ detail }: { detail: KnowledgeDetail }) => {
  const source = detail.sourceContext

  return (
    <section
      aria-label="Source context"
      data-testid="knowledge-source"
      className="rounded border border-slate-300 bg-white px-4 py-3"
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={fact}>
          <dt className={term}>Repository</dt>
          <dd className={value}>{source.nameWithOwner ?? "Not recorded"}</dd>
        </div>
        <div className={fact}>
          <dt className={term}>Pull request</dt>
          <dd className={value}>
            {/* A null number is a run that carries no job. It is a fact about
                the source, never a zero. */}
            {source.pullRequestNumber === null
              ? "Not recorded"
              : `#${source.pullRequestNumber}${
                  source.pullRequestTitle === null ? "" : ` ${source.pullRequestTitle}`
                }`}
          </dd>
        </div>
        <div className={fact}>
          <dt className={term}>Author</dt>
          <dd className={value}>{source.pullRequestAuthorLogin ?? "Not recorded"}</dd>
        </div>
        <div className={fact}>
          <dt className={term}>Merged</dt>
          <dd className={value}>{source.mergedAt ?? "Not recorded"}</dd>
        </div>
      </dl>
      {source.pullRequestUrl === null ? null : (
        <p className="mt-3 text-sm">
          {/* The contract constrains this to a github.com https URL, so the
              host is allowlisted by the schema rather than by this component. */}
          <a
            href={source.pullRequestUrl}
            rel="noreferrer"
            className="text-slate-900 underline underline-offset-2"
          >
            Open the pull request on GitHub
          </a>
        </p>
      )}
    </section>
  )
}

export const KnowledgeEvidenceList = ({ view }: { view: KnowledgeEvidenceView }) => {
  if (view.status === "unavailable") {
    // Not an empty list. An empty list would claim the object has no
    // supporting quote, which is a different statement from not knowing, and
    // `KD-002` requires the attribution before a decision.
    return (
      <ConsoleUnavailable
        failure={view.failure}
        heading="The evidence for this Knowledge Object is not available right now"
      />
    )
  }

  const evidence = view.evidence.evidence

  return (
    <section
      aria-label="Evidence"
      data-testid="knowledge-evidence"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-slate-900">Evidence</h2>
        <p className="text-xs text-slate-600">
          The exact quotes this claim was extracted from. Only the persisted quote and
          its attribution are published; the source document is not.
        </p>
      </div>
      {evidence.length === 0 ? (
        <p className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          No evidence quote is recorded for this Knowledge Object.
        </p>
      ) : (
        <ol aria-label="Evidence quotes" className="flex flex-col gap-3">
          {evidence.map((item) => (
            <li
              key={item.evidenceId}
              data-testid="knowledge-evidence-item"
              className="flex flex-col gap-2 rounded border border-slate-300 bg-white px-4 py-3"
            >
              <blockquote className="border-l-2 border-slate-400 pl-3 text-sm text-slate-900">
                {item.quote}
              </blockquote>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className={fact}>
                  <dt className={term}>Author</dt>
                  <dd className="text-xs text-slate-700">{item.author}</dd>
                </div>
                <div className={fact}>
                  <dt className={term}>Source type</dt>
                  <dd className="text-xs text-slate-700">{item.sourceType}</dd>
                </div>
                <div className={fact}>
                  <dt className={term}>Location</dt>
                  <dd className="text-xs text-slate-700">
                    {item.sourceUrl === null ? (
                      item.source
                    ) : (
                      <a
                        href={item.sourceUrl}
                        rel="noreferrer"
                        className="text-slate-900 underline underline-offset-2"
                      >
                        {item.source}
                      </a>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

const costLine = (
  cost: NonNullable<KnowledgeDetail["technicalDetails"]["cost"]>,
): string => {
  switch (cost.completeness) {
    case "MEASURED":
      return `${cost.measuredUsd} USD, settled`
    case "RESERVED":
      return `${cost.reservedUsd} USD held, not yet settled`
    case "UNRESOLVED":
      // Never a zero and never a bare dash: an amount exists but cannot be
      // attributed, which is a different fact from costing nothing.
      return `${cost.unresolvedUsd} USD recorded but not attributable`
    case "NOT_APPLICABLE":
      return "No contributing job, so no cost"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported cost state"
    default: {
      const exhaustive: never = cost.completeness
      throw new Error(`unhandled cost completeness: ${String(exhaustive)}`)
    }
  }
}

export const KnowledgeTechnicalDetails = ({ detail }: { detail: KnowledgeDetail }) => {
  const technical = detail.technicalDetails
  const derivative = detail.review?.latestReview

  return (
    <details
      data-testid="knowledge-technical"
      className="rounded border border-slate-300 bg-white px-4 py-3"
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        Technical details
      </summary>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className={fact}>
          <dt className={term}>Extraction run</dt>
          <dd className="font-mono text-xs text-slate-700">
            {technical.extractionRunId}
          </dd>
        </div>
        <div className={fact}>
          <dt className={term}>Admission</dt>
          <dd className="text-xs text-slate-700">
            {technical.admissionDisposition} by {technical.admissionDecisionOrigin}
          </dd>
        </div>
        <div className={fact}>
          <dt className={term}>Model</dt>
          <dd className="text-xs text-slate-700">
            {technical.resolvedModelId ?? "Not recorded"}
          </dd>
        </div>
        <div className={fact}>
          <dt className={term}>Semantic pipeline</dt>
          <dd className="font-mono text-xs break-all text-slate-700">
            {technical.semanticPipelineFingerprint ?? "Not recorded"}
          </dd>
        </div>
        <div className={fact}>
          <dt className={term}>Extracted</dt>
          <dd className="text-xs text-slate-700">
            {technical.extractedAt ?? "Not recorded"}
          </dd>
        </div>
        <div className={fact}>
          <dt className={term}>Latency</dt>
          <dd className="text-xs text-slate-700">
            {technical.latencyMs === undefined || technical.latencyMs === null
              ? "Not recorded"
              : `${technical.latencyMs} ms`}
          </dd>
        </div>
        <div className={fact}>
          <dt className={term}>Cost</dt>
          <dd className="text-xs text-slate-700">
            {/* Not invoice authority. It is what this extraction recorded. */}
            {technical.cost === undefined ? "Not recorded" : costLine(technical.cost)}
          </dd>
        </div>
        <div className={fact}>
          <dt className={term}>Token usage</dt>
          <dd className="text-xs text-slate-700">
            {technical.tokenUsage === undefined
              ? "Not recorded"
              : Object.entries(technical.tokenUsage)
                  .map(([name, count]) => `${name} ${String(count)}`)
                  .join(", ")}
          </dd>
        </div>
        {/* `KD-001` asks for the edit schema version here rather than beside
            the derivative, so the reviewer's words stay readable as words. */}
        {derivative?.editSchemaVersion === undefined ? null : (
          <div className={fact}>
            <dt className={term}>Edit schema</dt>
            <dd className="text-xs text-slate-700">
              Version {derivative.editSchemaVersion}
            </dd>
          </div>
        )}
      </dl>
    </details>
  )
}
