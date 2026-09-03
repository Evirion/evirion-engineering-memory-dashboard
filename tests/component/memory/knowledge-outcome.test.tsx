import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  KNOWLEDGE_RESPONSE_CODES,
  KnowledgeOutcomeNotice,
} from "@/components/memory/knowledge-outcome"
import { readCommandResult } from "@/components/repositories/command-outcome"

import { repositoryRoot } from "../../support/source-tree"

/**
 * EEM-9/05 C05, the trap EEM-9/04 fell into.
 *
 * `readCommandResult` knows the published error codes and the word `applied`,
 * and nothing else. None of the four knowledge response codes is a published
 * error code, so routing one through it fails closed and tells the customer
 * the outcome is unknown for a command that committed and changed state.
 *
 * These tests pin both halves: the shared reader really does fail closed on a
 * receipt code, and this surface really does read its own before delegating.
 */

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe("the shared reader", () => {
  it.each(KNOWLEDGE_RESPONSE_CODES)("fails closed on %s", (code) => {
    // Not a criticism of the shared reader: it is EEM-9/03's and it is right
    // to refuse a code it was never given. It is the reason this surface
    // cannot delegate its own outcomes to it.
    expect(readCommandResult(code)).toEqual({
      kind: "unknown",
      code: "UNSUPPORTED_SERVER_RESPONSE",
    })
  })

  it("is left unmodified by this subtask", () => {
    // The shared reader belongs to EEM-9/03. Teaching it these codes would
    // move a file this subtask does not own, so the boundary is asserted.
    const source = readFileSync(
      fileURLToPath(
        new URL("src/components/repositories/command-outcome.tsx", repositoryRoot),
      ),
      "utf8",
    )

    for (const code of KNOWLEDGE_RESPONSE_CODES) {
      expect(source).not.toContain(code)
    }
  })
})

describe("the knowledge outcome notice", () => {
  it.each([
    ["KNOWLEDGE_REVIEW_RECORDED", "Your review is recorded."],
    ["KNOWLEDGE_MARKED_ACTIVE", "This Knowledge Object is now active."],
    ["KNOWLEDGE_MARKED_SUPERSEDED", "This Knowledge Object is now superseded."],
    ["KNOWLEDGE_CORRECTION_REQUESTED", "Your correction request is with Evirion."],
  ])("reports %s as the committed outcome it is", (code, headline) => {
    const html = markup(<KnowledgeOutcomeNotice result={code} />)

    expect(html).toContain(headline)
    expect(html).not.toContain("The outcome is not known yet")
  })

  it("keeps the two axes apart in what it claims changed", () => {
    // Recording a review does not activate anything, and activating does not
    // close a review. Saying so is where a customer learns the difference.
    expect(
      markup(<KnowledgeOutcomeNotice result="KNOWLEDGE_REVIEW_RECORDED" />),
    ).toContain("does not change the lifecycle")
    expect(
      markup(<KnowledgeOutcomeNotice result="KNOWLEDGE_MARKED_ACTIVE" />),
    ).toContain("review history is unchanged")
  })

  it("says a supersession does not activate the newer object", () => {
    expect(
      markup(<KnowledgeOutcomeNotice result="KNOWLEDGE_MARKED_SUPERSEDED" />),
    ).toContain("is not activated by this")
  })

  it("says a correction request has changed nothing yet", () => {
    // The customer creates and reads a request. An operator applies it, and
    // until then no state has moved.
    expect(
      markup(<KnowledgeOutcomeNotice result="KNOWLEDGE_CORRECTION_REQUESTED" />),
    ).toContain("Nothing has changed yet")
  })

  it("delegates a published error code to the shared reader", () => {
    const html = markup(<KnowledgeOutcomeNotice result="REVIEW_VERSION_CONFLICT" />)

    expect(html).toContain("This changed while you were working")
  })

  it("fails closed on a code no contract publishes", () => {
    const html = markup(<KnowledgeOutcomeNotice result="KNOWLEDGE_TOTALLY_FINE" />)

    // A crafted URL cannot print arbitrary text, and an unpublished code is
    // not echoed as though it meant something.
    expect(html).toContain("The outcome is not known yet")
    expect(html).not.toContain("KNOWLEDGE_TOTALLY_FINE")
  })

  it("renders nothing when no command was sent", () => {
    expect(markup(<KnowledgeOutcomeNotice result={undefined} />)).toBe("")
  })
})
