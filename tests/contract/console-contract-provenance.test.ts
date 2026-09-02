import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { CONSOLE_CONTRACT_PROVENANCE } from "@contracts/console"
import { repositoryRoot } from "../support/source-tree"

type ContractLock = {
  artifact: { assetId: number; assetName: string; assetSha256: string; tag: string }
  contract: { contractVersion: string; packageSha256: string }
  repository: string
  sourceCommit: string
}

/**
 * Implementation task C01 step 7 asks for a contract digest inside `src`.
 * EEM-9/01b already delivered it as an attestation-verified lock plus a
 * generated client, so the Console consumes those bytes through a path alias
 * instead of holding a second copy. This is the assertion that keeps the two
 * from drifting. See ADR-0003.
 */
describe("pinned Console contract provenance", () => {
  const lock = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("docs/contracts/console-contract-lock.json", repositoryRoot),
      ),
      "utf8",
    ),
  ) as ContractLock

  it("matches the attestation-verified contract lock exactly", () => {
    expect(CONSOLE_CONTRACT_PROVENANCE.repository).toBe(lock.repository)
    expect(CONSOLE_CONTRACT_PROVENANCE.sourceCommit).toBe(lock.sourceCommit)
    expect(CONSOLE_CONTRACT_PROVENANCE.releaseTag).toBe(lock.artifact.tag)
    expect(CONSOLE_CONTRACT_PROVENANCE.assetId).toBe(lock.artifact.assetId)
    expect(CONSOLE_CONTRACT_PROVENANCE.assetName).toBe(lock.artifact.assetName)
    expect(CONSOLE_CONTRACT_PROVENANCE.archiveSha256).toBe(lock.artifact.assetSha256)
    expect(CONSOLE_CONTRACT_PROVENANCE.packageSha256).toBe(lock.contract.packageSha256)
    expect(CONSOLE_CONTRACT_PROVENANCE.contractVersion).toBe(
      lock.contract.contractVersion,
    )
  })

  it("holds no second copy of the generated client under src", () => {
    const duplicate = new URL("src/lib/contracts/generated", repositoryRoot)

    expect(() => readFileSync(fileURLToPath(duplicate))).toThrow()
  })
})
