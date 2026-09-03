import Link from "next/link"
import { notFound } from "next/navigation"

import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  KnowledgeEvidenceList,
  KnowledgeSourceContext,
  KnowledgeStates,
  KnowledgeTechnicalDetails,
} from "@/components/memory/knowledge-detail"
import { KnowledgeOutcomeNotice } from "@/components/memory/knowledge-outcome"
import { KnowledgePayloads } from "@/components/memory/knowledge-payload"
import { ReviewActions } from "@/components/memory/review-actions"
import { ReviewHistory } from "@/components/memory/review-history"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { readKnowledgeDetail } from "@/server/queries/knowledge"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/** One key per rendered form, so a duplicate click replays instead of repeating. */
const mintIdempotencyKeys = (): Record<string, string> =>
  Object.fromEntries(
    ["approve", "revert", "edit", "reject"].map((action) => [
      action,
      crypto.randomUUID(),
    ]),
  )

/**
 * One Knowledge Object with its evidence and provenance.
 *
 * A machine `REJECTED` or `QUARANTINED` extraction answers here exactly as an
 * identifier belonging to another tenant does. Both are legitimate outcomes
 * that produced no knowledge, and neither may render as a Knowledge Object, so
 * neither gets a page that confirms it exists.
 */
const KnowledgeDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ knowledgeObjectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const { knowledgeObjectId } = await params
  const requested = (await searchParams)["result"]
  const outcome = typeof requested === "string" ? requested : undefined
  const view = await readKnowledgeDetail(knowledgeObjectId)

  if (view.status === "not-found") notFound()

  if (view.status === "unavailable") {
    return (
      <section className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold tracking-tight">Knowledge Object</h1>
        <ConsoleUnavailable
          failure={view.failure}
          heading="This Knowledge Object is not available right now"
        />
      </section>
    )
  }

  const { detail, controls } = view
  const csrfToken = await readSessionCsrfToken()
  const idempotencyKeys = mintIdempotencyKeys()

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{detail.knowledge}</h1>
        <p className="text-sm text-slate-600">
          {detail.knowledgeType} extracted from {detail.author}'s work
        </p>
      </div>

      <nav aria-label="Memory sections">
        <Link
          href="/memory"
          prefetch={false}
          className="text-sm text-slate-900 underline underline-offset-2"
        >
          Back to the review queue
        </Link>
      </nav>

      <KnowledgeOutcomeNotice result={outcome} />

      <KnowledgeStates detail={detail} />
      <KnowledgeSourceContext detail={detail} />
      <KnowledgePayloads detail={detail} />
      {/* Evidence sits above every control. `KD-002` requires the attribution
          to be readable before a review decision is taken. */}
      <KnowledgeEvidenceList view={view.evidence} />
      <ReviewActions
        detail={detail}
        controls={controls}
        csrfToken={csrfToken}
        idempotencyKeys={idempotencyKeys}
      />
      <ReviewHistory view={view.history} />
      <KnowledgeTechnicalDetails detail={detail} />
    </section>
  )
}

export default KnowledgeDetailPage
