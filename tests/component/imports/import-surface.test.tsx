import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { Repository, RepositoryImport } from "@contracts/console"

import {
  ApproveForm,
  ImportFailureList,
  PrepareForm,
  RunStateForms,
} from "@/components/imports/import-actions"
import { ImportCost, ImportProgress } from "@/components/imports/import-progress"
import {
  AuthorizationPanel,
  ImportStatusPanel,
} from "@/components/imports/import-status"

import {
  IMPORTS,
  IMPORT_FAILURES,
  IMPORT_RUNS,
  REPOSITORIES,
  SCENARIOS,
} from "../../../tools/console-stub/fixtures.mjs"

/**
 * EEM-9/04 C04-1 and C04-6.
 *
 * The two waits must be told apart by something a reader can perceive, the
 * counters must stay in two groups, an unresolved cost must not read as zero,
 * and no control may appear that the backend capability does not permit. Each
 * of those is asserted against the rendered document rather than against the
 * function that produced it.
 */

const repositories = SCENARIOS.default().repositories
const find = (id: string): Repository =>
  repositories.find((repository) => repository.id === id) as Repository

const repository = find(REPOSITORIES.activeSourceOnly)
const locked = find(REPOSITORIES.availableLocked)

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

const context = (current: RepositoryImport | null) => ({
  repository,
  current,
  csrfToken: "csrf-token",
  idempotencyKeys: {
    prepare: "00000000-0000-4000-8000-00000000b001",
    approve: "00000000-0000-4000-8000-00000000b002",
    pause: "00000000-0000-4000-8000-00000000b003",
    resume: "00000000-0000-4000-8000-00000000b004",
    cancel: "00000000-0000-4000-8000-00000000b005",
    "retry:41": "00000000-0000-4000-8000-00000000b006",
  },
})

describe("the two waits", () => {
  it("says who each one is waiting on, in text", () => {
    const customer = markup(
      <AuthorizationPanel current={IMPORT_RUNS.awaitingApproval()} />,
    )
    const evirion = markup(
      <AuthorizationPanel current={IMPORT_RUNS.awaitingAuthorization()} />,
    )

    expect(customer).toContain('data-waiting-on="customer"')
    expect(evirion).toContain('data-waiting-on="evirion"')
    // Text, so the distinction never depends on colour or on a shared spinner.
    expect(customer).toContain("Waiting for your approval")
    expect(evirion).toContain("Waiting for Evirion authorization")
  })

  it("renders no control at all while Evirion is the one being waited on", () => {
    const run = IMPORT_RUNS.awaitingAuthorization()
    const panel = markup(<AuthorizationPanel current={run} />)
    const forms = markup(<ApproveForm {...context(run)} />)

    expect(panel).toMatch(/no action for you to take/)
    // The backend withholds `canApprove` here, so approving is not offered and
    // could not satisfy the wait if it were.
    expect(run.capabilities.canApprove).toBe(false)
    expect(forms).toBe("")
  })

  it("keeps the run status and the authorization apart when they disagree", () => {
    // The run is PROCESSING while authorization is pending. A surface reading
    // status alone would claim extraction is under way.
    const run = IMPORT_RUNS.awaitingAuthorization()
    const rendered =
      markup(<ImportStatusPanel current={run} />) +
      markup(<AuthorizationPanel current={run} />)

    expect(run.status).toBe("PROCESSING")
    expect(rendered).toContain("Waiting for Evirion authorization")
    expect(rendered).toContain("Extracting Engineering Memory")
    expect(rendered).toContain('data-waiting-on="evirion"')
  })

  it("offers a fresh request when the authorization expired", () => {
    const run = IMPORT_RUNS.paused()

    expect(markup(<ApproveForm {...context(run)} />)).toContain(
      "Request extraction again",
    )
  })
})

describe("progress", () => {
  it("reports work and machine outcomes as two labelled groups", () => {
    const rendered = markup(<ImportProgress current={IMPORT_RUNS.completed()} />)

    expect(rendered).toContain('data-testid="import-work-counts"')
    expect(rendered).toContain('data-testid="import-disposition-counts"')
    expect(rendered).toContain("Quarantined")
    expect(rendered).toContain("Rejected")
    expect(rendered).toContain("Accepted")
    expect(rendered).toContain("Failed")
  })

  it("never presents a rejected or quarantined outcome as memory", () => {
    const rendered = markup(<ImportProgress current={IMPORT_RUNS.completed()} />)

    expect(rendered).toMatch(/These are model decisions, not infrastructure failures/)
    expect(rendered).toMatch(/Only accepted work/)
  })
})

describe("cost completeness", () => {
  it("shows no amount at all when the cost is unresolved", () => {
    const rendered = markup(<ImportCost current={IMPORT_RUNS.failed()} />)

    expect(rendered).toContain('data-cost-completeness="UNRESOLVED"')
    expect(rendered).toContain("No amount to show")
    expect(rendered).toMatch(/Pending reconciliation/)
  })

  it("shows a settled amount only where the backend settled it", () => {
    const rendered = markup(<ImportCost current={IMPORT_RUNS.completed()} />)

    expect(rendered).toContain('data-cost-completeness="MEASURED"')
    expect(rendered).toContain("USD 18.400000")
  })

  it("names reserved and unresolved beside the measured amount", () => {
    const rendered = markup(<ImportCost current={IMPORT_RUNS.processing()} />)

    expect(rendered).toContain('data-cost-completeness="RESERVED"')
    expect(rendered).toContain("USD 9.400000")
    expect(rendered).toContain("USD 2.100000")
    expect(rendered).toMatch(/not an invoice/)
  })
})

describe("controls follow the backend capability", () => {
  it("offers approval only where the projection permits it", () => {
    expect(
      markup(<ApproveForm {...context(IMPORT_RUNS.awaitingApproval())} />),
    ).toContain("Approve extraction")
    expect(markup(<ApproveForm {...context(IMPORT_RUNS.processing())} />)).toBe("")
    expect(markup(<ApproveForm {...context(IMPORT_RUNS.completed())} />)).toBe("")
  })

  it("offers pause, resume and cancel only where the projection permits them", () => {
    const processing = markup(<RunStateForms {...context(IMPORT_RUNS.processing())} />)
    const paused = markup(<RunStateForms {...context(IMPORT_RUNS.paused())} />)

    expect(processing).toContain("Pause import")
    expect(processing).not.toContain("Resume import")
    expect(paused).toContain("Resume import")
    expect(paused).not.toContain("Pause import")
    // A terminal run permits nothing, so nothing is drawn.
    expect(markup(<RunStateForms {...context(IMPORT_RUNS.completed())} />)).toBe("")
  })

  it("offers preparation only for an active entitlement with no current run", () => {
    expect(markup(<PrepareForm {...context(null)} />)).toContain("Prepare import")
    // A run already exists, so a second one would be refused as already active.
    expect(markup(<PrepareForm {...context(IMPORT_RUNS.processing())} />)).toBe("")
    expect(
      markup(<PrepareForm {...context(null)} repository={locked} current={null} />),
    ).toBe("")
  })
})

describe("recovery is only what the projection declared", () => {
  const failures = {
    status: "ready" as const,
    failures: {
      importId: IMPORTS.failed,
      failures: IMPORT_FAILURES()[IMPORTS.failed] ?? [],
    },
  }

  it("draws a retry only beside work the backend declared retryable", () => {
    const rendered = markup(
      <ImportFailureList {...context(IMPORT_RUNS.failed())} failures={failures} />,
    )

    expect(rendered).toContain('data-retryable="yes"')
    expect(rendered).toContain('data-retryable="no"')
    // One retryable entry means exactly one retry form.
    expect(rendered.match(/action="\/api\/imports\/retry"/g)).toHaveLength(1)
    expect(rendered).toContain("The backend has declared this work not retryable.")
  })

  it("renders no generic Retry, Resume and Support call to action", () => {
    // `PROC-002` belongs to `/processing`, which EEM-9/06 owns. Reproducing it
    // here is the ownership violation the plan calls out by name.
    const rendered =
      markup(<ImportStatusPanel current={IMPORT_RUNS.failed()} />) +
      markup(
        <ImportFailureList {...context(IMPORT_RUNS.failed())} failures={failures} />,
      )

    expect(rendered).not.toMatch(/Retry, Resume and Support/)
    expect(rendered).not.toContain("/processing")
  })

  it("reports an unreadable failure list as unreadable, never as none", () => {
    const rendered = markup(
      <ImportFailureList
        {...context(IMPORT_RUNS.failed())}
        failures={{
          status: "unavailable",
          failure: {
            code: "DEPENDENCY_UNAVAILABLE",
            treatment: "retry-bounded",
            message: "The service is busy. Try again shortly.",
            retryable: true,
          },
        }}
      />,
    )

    expect(rendered).toMatch(/could not be read/)
    expect(rendered).toMatch(/does not mean there is none/)
    expect(rendered).not.toContain('action="/api/imports/retry"')
  })
})

describe("every mutation the surface offers", () => {
  const rendered = [
    markup(<PrepareForm {...context(null)} />),
    markup(<ApproveForm {...context(IMPORT_RUNS.awaitingApproval())} />),
    markup(<RunStateForms {...context(IMPORT_RUNS.processing())} />),
  ].join("")

  it("carries a CSRF proof and one idempotency key per form", () => {
    const forms = rendered.match(/<form/g) ?? []
    const proofs = rendered.match(/name="csrfToken"/g) ?? []
    const keys = rendered.match(/name="idempotencyKey"/g) ?? []

    expect(forms.length).toBeGreaterThan(0)
    expect(proofs).toHaveLength(forms.length)
    expect(keys).toHaveLength(forms.length)
  })

  it("forwards the observed status as the optimistic token, never a version", () => {
    const approve = markup(<ApproveForm {...context(IMPORT_RUNS.awaitingApproval())} />)

    expect(approve).toContain('name="expectedStatus" value="AWAITING_APPROVAL"')
    expect(approve).not.toContain('name="expectedVersion"')
  })

  it("names approval as consent that does not authorize Evirion", () => {
    const approve = markup(<ApproveForm {...context(IMPORT_RUNS.awaitingApproval())} />)

    expect(approve).toMatch(/authorizes paid model calls/)
    expect(approve).toMatch(/does not grant Evirion operational\s+authorization/)
  })

  it("states that preparation is free before anything paid is offered", () => {
    expect(markup(<PrepareForm {...context(null)} />)).toMatch(
      /make no model call and cost\s+nothing/,
    )
  })
})
