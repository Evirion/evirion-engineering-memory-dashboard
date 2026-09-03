import Link from "next/link"
import { notFound } from "next/navigation"

import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  KnowledgeEvidenceList,
  KnowledgeSourceContext,
  KnowledgeStates,
  KnowledgeTechnicalDetails,
} from "@/components/memory/knowledge-detail"
import { KnowledgePayloads } from "@/components/memory/knowledge-payload"
import { readKnowledgeDetail } from "@/server/queries/knowledge"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

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
}: {
  params: Promise<{ knowledgeObjectId: string }>
}) => {
  const { knowledgeObjectId } = await params
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

  const { detail } = view

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

      <KnowledgeStates detail={detail} />
      <KnowledgeSourceContext detail={detail} />
      <KnowledgePayloads detail={detail} />
      {/* Evidence sits above every control. `KD-002` requires the attribution
          to be readable before a review decision is taken. */}
      <KnowledgeEvidenceList view={view.evidence} />
      <KnowledgeTechnicalDetails detail={detail} />
    </section>
  )
}

export default KnowledgeDetailPage
