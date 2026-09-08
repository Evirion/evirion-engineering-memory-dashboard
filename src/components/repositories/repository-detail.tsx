import Link from "next/link"

import type { Repository } from "@contracts/console"

import {
  entitlementSourceLabel,
  retiredNamedByConsent,
} from "@/lib/repositories/presentation"
import { POLICY_TERMS } from "@/lib/repositories/vocabulary"
import type { ModelProfileCatalogueView } from "@/server/queries/repositories"

/**
 * The read-only facts behind the three axes.
 *
 * Source, generation and version are shown because a customer raising a
 * support question needs them. None of them is selectable: they arrive from
 * the backend and the UI only reflects them.
 */
export const EntitlementFacts = ({ repository }: { repository: Repository }) => (
  <section aria-label="Entitlement" className="flex flex-col gap-2">
    <h2 className="text-sm font-semibold text-foreground">Entitlement</h2>
    {repository.entitlement === null ? (
      <p className="text-sm text-ink-secondary">
        This repository has no Evirion entitlement. GitHub access alone never activates
        one, and nothing is read from the repository until it is activated.
      </p>
    ) : (
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            State
          </dt>
          <dd className="text-sm text-foreground">
            {repository.entitlement.state === "ACTIVE" ? "Active" : "Disabled"}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Granted as
          </dt>
          <dd className="text-sm text-foreground">
            {entitlementSourceLabel(repository.entitlement.source)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Generation
          </dt>
          <dd className="text-sm text-foreground">
            {repository.entitlement.generation}
          </dd>
        </div>
      </dl>
    )}
  </section>
)

/**
 * A recorded consent naming a profile the organization is no longer offered.
 *
 * Withdrawing an offer does not revoke a consent already given, so the backend
 * can produce this and the customer cannot resolve it by themselves. It gets
 * its own treatment rather than silence: dropping the row would hide part of a
 * live consent, and listing it as an ordinary profile would imply it can still
 * be chosen. Like an operator-managed allowance, it is a state, not a failure.
 */
const RetiredProfileNotice = ({
  view,
  consented,
}: {
  view: ModelProfileCatalogueView
  consented: readonly string[]
}) => {
  if (view.status === "unavailable") return null
  const retired = retiredNamedByConsent(view.catalogue, consented)
  if (retired.length === 0) return null

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted px-3 py-2">
      <p className="text-sm font-medium text-foreground">
        {retired.length === 1
          ? "This consent names a model profile Evirion no longer offers"
          : "This consent names model profiles Evirion no longer offers"}
      </p>
      <ul className="flex flex-col gap-1">
        {retired.map((profile) => (
          <li key={profile.canonicalIdentifier} className="text-sm text-foreground">
            {profile.label}
            <span className="ml-2 text-xs text-ink-secondary">
              {profile.offeringState === "RETIRED" ? "retired" : "deprecated"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-secondary">
        The consent is unchanged and Evirion decides which profiles are offered, so
        there is nothing to fix here. Automatic extraction will not use a profile that
        is no longer offered. To keep it running, record consent again and choose from
        what is currently offered.
      </p>
    </div>
  )
}

export const ConsentFacts = ({
  repository,
  modelProfiles,
}: {
  repository: Repository
  modelProfiles: ModelProfileCatalogueView
}) => (
  <section aria-label="Recorded consent" className="flex flex-col gap-2">
    <h2 className="text-sm font-semibold text-foreground">Recorded consent</h2>
    {repository.effectiveConsent === null ? (
      <p className="text-sm text-ink-secondary">
        No consent is recorded for this repository, so no model call can be authorized
        for it.
      </p>
    ) : (
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Model profiles
          </dt>
          <dd className="text-sm text-foreground">
            {repository.effectiveConsent.allowedModelProfiles.join(", ")}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Call ceiling
          </dt>
          <dd className="text-sm text-foreground">
            {repository.effectiveConsent.callCeiling}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Budget ceiling
          </dt>
          {/* A ceiling, never an invoice figure and never a spend total. */}
          <dd className="text-sm text-foreground">
            {repository.effectiveConsent.budgetCeilingUsd} USD ceiling
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Expires
          </dt>
          <dd className="text-sm text-foreground">
            {repository.effectiveConsent.expiresAt}
          </dd>
        </div>
      </dl>
    )}
    {repository.effectiveConsent === null ? null : (
      <RetiredProfileNotice
        view={modelProfiles}
        consented={repository.effectiveConsent.allowedModelProfiles}
      />
    )}
  </section>
)

export const ChangeRequestNotice = ({ repository }: { repository: Repository }) =>
  repository.changeRequest === null ? null : (
    <section
      aria-label="Change request"
      className="flex flex-col gap-2 rounded-2xl border border-border bg-muted px-5 py-4"
    >
      <h2 className="text-sm font-semibold text-foreground">Change request</h2>
      {/* Waiting on an operator is a state, not a failure, and offers no
          customer action. */}
      <p className="text-sm text-ink-secondary">
        A repository change is recorded and is with an Evirion operator. There is
        nothing further to do here, and the current entitlement is unchanged until the
        operator applies it.
      </p>
    </section>
  )

/**
 * Prefetching is off deliberately. Every authenticated response here is
 * force-dynamic and no-store, so speculatively fetching a tenant document the
 * customer never asked for would put it in play for no benefit.
 */
export const BackToRepositories = () => (
  <Link
    href="/repositories"
    prefetch={false}
    className="text-sm text-foreground underline underline-offset-2"
  >
    Back to repositories
  </Link>
)

/**
 * The four gates, stated separately.
 *
 * A customer who believes consent authorized a paid call has been misled by a
 * screen, so this block never merges the four and never implies that answering
 * one satisfies another.
 */
export const PolicyVocabulary = () => (
  <section aria-label="What each step means" className="flex flex-col gap-2">
    <h2 className="text-sm font-semibold text-foreground">What each step means</h2>
    <dl className="flex flex-col gap-3">
      {POLICY_TERMS.map((term) => (
        <div key={term.id} className="flex flex-col gap-1">
          <dt className="text-sm font-medium text-foreground">
            {term.term}
            <span className="ml-2 text-xs font-normal text-ink-secondary">
              {term.heldBy === "you" ? "you decide this" : "Evirion decides this"}
            </span>
          </dt>
          <dd className="text-sm text-ink-secondary">{term.meaning}</dd>
        </div>
      ))}
    </dl>
  </section>
)
