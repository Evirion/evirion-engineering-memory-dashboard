import { describe, expect, it } from "vitest"

import { isAllowedMutationPath } from "@/lib/auth/reauthentication-action-class"
import { normalizeReturnPath } from "@/lib/auth/reauthentication-return-path"
import {
  formFieldsFrom,
  readPendingMutation,
  serializePendingMutation,
} from "@/lib/auth/reauthentication-state"

describe("normalizeReturnPath", () => {
  it("preserves customer filters while stripping ceremony markers", () => {
    expect(
      normalizeReturnPath(
        "/memory/00000000-0000-4000-8000-00000000a001?supersedeWith=00000000-0000-4000-8000-00000000a002&reauth=required&result=REQUEST_INVALID",
      ),
    ).toBe(
      "/memory/00000000-0000-4000-8000-00000000a001?supersedeWith=00000000-0000-4000-8000-00000000a002",
    )
  })

  it("refuses off-origin targets", () => {
    expect(normalizeReturnPath("https://evil.example/steal")).toBe("/")
  })
})

describe("pending mutation cookie", () => {
  const secret = "test-signing-key-at-least-thirty-two-bytes"

  it("binds replay to the session that paused the mutation", async () => {
    const token = await serializePendingMutation(secret, {
      returnPath: "/repositories/00000000-0000-4000-8000-00000000b001/import",
      mutationPath: "/api/imports/approve",
      gate: "repository_import",
      actionClass: "membership_change",
      fields: { costBudgetUsd: "25" },
      providerSessionId: "00000000-0000-4000-8000-00000000d001",
      expiresAt: Date.now() + 60_000,
    })

    expect(
      await readPendingMutation(secret, token, {
        providerSessionId: "00000000-0000-4000-8000-00000000d001",
      }),
    ).toBeDefined()
    expect(
      await readPendingMutation(secret, token, {
        providerSessionId: "00000000-0000-4000-8000-00000000d002",
      }),
    ).toBeUndefined()
  })

  it("expires paused mutations", async () => {
    const token = await serializePendingMutation(secret, {
      returnPath: "/memory/00000000-0000-4000-8000-00000000a001",
      mutationPath: "/api/memory/activate",
      gate: "knowledge_lifecycle",
      actionClass: "knowledge_lifecycle",
      fields: { note: "Queue note preserved through step-up" },
      providerSessionId: "00000000-0000-4000-8000-00000000d001",
      expiresAt: Date.now() - 1,
    })

    expect(await readPendingMutation(secret, token)).toBeUndefined()
  })
})

describe("mutation path allowlist", () => {
  it("rejects paths outside the gate", () => {
    expect(isAllowedMutationPath("repository_import", "/api/memory/activate")).toBe(
      false,
    )
    expect(isAllowedMutationPath("knowledge_lifecycle", "/api/imports/approve")).toBe(
      false,
    )
  })

  it("accepts the shipped mutation paths", () => {
    expect(isAllowedMutationPath("repository_import", "/api/imports/approve")).toBe(
      true,
    )
    expect(isAllowedMutationPath("knowledge_lifecycle", "/api/memory/activate")).toBe(
      true,
    )
  })
})

describe("formFieldsFrom", () => {
  it("preserves customer-entered note text for replay", () => {
    const form = new FormData()
    form.set("note", "Queue note preserved through step-up")
    expect(formFieldsFrom(form)["note"]).toBe("Queue note preserved through step-up")
  })
})
