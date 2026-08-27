# EEM-9/01 Dashboard repository bootstrap contract

Status: implementation contract accepted by the existing EEM-9 authorities; Dashboard delivery in progress.

## Purpose and boundary

EEM-9/01 establishes source-controlled Dashboard requirements, architecture,
execution planning, security ownership, repository governance, and immutable
cross-repository authority verification before any Console runtime exists.

Prerequisites verified on 2026-08-27:

- backend `main` and `origin/main` are
  `b23f6ba2b11f583b61200cec63500a782992f1f0`, the merge of backend PR #24;
- the merged tree `48bd95459fa626af0c72133da9a9fc0cbe1dec50`
  equals the reviewed EEM-3/13 branch tree;
- migration 30 SHA-256 is
  `9d195b22eacb221f9dbd120b23d259f8ad7163252f2348767c4d608dc37d44d5`;
- the EEM-3 global-lock manifest SHA-256 is
  `ff422f622d60f43e41bb78e77a01c665b0dd100b80b701f71296c88486956f8d`;
- the merged PostgreSQL 17 lock-attestation suite passes 10 tests;
- Dashboard `main` and `origin/main` are
  `85c851202dd978af50dbdac1a599c74f3994c5ad`, with the existing `LICENSE`
  preserved;
- all five mandatory Obsidian sources resolve under one vault and were read in
  full. Their vault root is deliberately not recorded.

Scope is limited to authority migration, acceptance/security matrices,
repository rules, deterministic verification, and release-attestation policy.

Excluded: UI or runtime scaffold, Supabase mutation or hosted Auth
configuration, deployment, provider/model calls, paid work, workers, customer
data, and EEM-9/02 or EEM-4 implementation.

## Sources reviewed

Repository authorities:

- backend `AGENTS.md`, `docs/HANDOFF.md`, `docs/ROADMAP.md`,
  `docs/plans/active/README.md`, the complete EEM-9 plan, the complete portable
  program design, EEM-4, EEM-6, EEM-7, and EEM-8 plans, decisions index,
  documentation index, and EEM-3 global-lock architecture;
- EEM-9 plan sections 1 through Complete Definition of Done, especially
  Mandatory execution authorities, task-specific reading map, fixed
  Console/Auth contract, OWASP matrix, contract publication, and P01;
- portable design sections 1 through 14, especially principal/tenant contract,
  durable commands, provider authorization, review/lifecycle, global lock
  order, requirement ownership, release gates, and source disposition.

Accepted-package sources:

- requirements: all sections, including 10 and 17–20; source SHA-256
  `832cc5bf8352d8995598b4256c451dd54fb333683a206c93533dbe4b6e195fd4`;
- architecture: all sections 1–30, especially 1, 18, 20, and 28; source
  SHA-256
  `6b011bfb49d1aa8c0bf7c03474b9ef2990a9902305fcaa1d9688fcf21044ba58`;
- implementation plan: all sections and P01 through I03-B; source SHA-256
  `ab026e23a4a49c13e304adee9d86819f96291970accae71dea08a6c2f5155e41`;
- OWASP audit/threat model: all sections as a retained security-gate source;
  source SHA-256
  `c73c097bdb8cbad79cd88f50acf9b6af4c1ae7d858e76345d88aeb459fb6d0f6`;
- operations runbook: all sections as a retained operations-gate source;
  source SHA-256
  `2d384e32274835bf70838d5a32bb97711a14861b6247e436520bdaad9e7ce467`.

The source implementation plan and architecture contain pre-merge EEM-3/13
status text. Git, executable tests, and the user's merge confirmation resolve
that factual status to PR #24 merged at the backend commit above. This does not
change the accepted product or security decisions.

## Two-repository state transitions

```text
backend PR #24 merged and verified
  -> Dashboard main verified
  -> Dashboard EEM-9/01 branch
  -> authority bytes frozen and locally verified
  -> explicit user commit/push/PR authorization
  -> Dashboard PR merged
  -> backend main updated from that merge point
  -> backend EEM-9/01 pointer/attestation branch
  -> exact Dashboard commit/package digest pinned
  -> merged EEM-3/13 attestation rerun without accepted drift
  -> explicit user commit/push/PR authorization
  -> backend PR merged
  -> EEM-9/01 complete; EEM-4/01 may start separately
```

Any failed digest, authority, link, ownership, attestation, or lock check keeps
the current repository state unchanged and blocks the next transition. The
backend branch cannot start before the Dashboard PR is merged.

## Source-to-destination and disposition matrix

| Source | Destination | Disposition |
|---|---|---|
| Accepted requirements note | `docs/product/design-partner-console-requirements.md` | Adopt; preserve requirement and `.A<n>` identity; convert internal links only |
| Accepted architecture note | `docs/architecture/design-partner-console.md` | Adopt; preserve decisions; annotate verified post-PR #24 evidence |
| Accepted implementation note | `docs/plans/design-partner-console-implementation.md` | Adopt; preserve task aliases/ownership; annotate verified post-PR #24 evidence |
| Backend EEM-9 plan | `docs/plans/active/eem-9-design-partner-console-dashboard-and-certification.md` | Adopt as Dashboard execution authority |
| Portable program design | `docs/architecture/design-partner-console-program-design.md` | Adopt as portable boundary and decision evidence |
| Requirements acceptance rules plus implementation-plan ownership | `docs/requirements/acceptance-map.yaml` | Materialize without renumbering or owner reassignment |
| Requirements Section 18 | `docs/requirements/source-disposition.yaml` | Adopt retained/modified/rejected decisions; append P01 factual/security resolutions |
| OWASP audit note | Obsidian URI plus vault-relative fallback only | Retain as mandatory `/07–/10` gate source; do not copy |
| Operations runbook note | Obsidian URI plus vault-relative fallback only | Retain as mandatory `/07–/10` gate source; do not copy |
| EEM-4/EEM-6–8 plans | Immutable backend commit links | Retain in backend; do not duplicate as Dashboard authority |
| Downloaded pre-acceptance source plan | Disposition record only | Historical input; never current authority |

## Read and mutation matrix

| Branch | Reads | Permitted writes | No-side-effect invariant |
|---|---|---|---|
| Prerequisite verification | Git refs, PR #24 metadata, merged lock bytes/tests | none | no repository or remote state change |
| Source migration | five accepted sources and repository authorities | Dashboard documentation only | no source-note mutation and no local path publication |
| Acceptance generation | migrated requirements and frozen ownership map | acceptance/source-disposition files | no ID renumbering, tombstone removal, or owner reassignment |
| Security bootstrap | pinned ASVS source and accepted EEM-9 policy | Dashboard ASVS/policy/fixtures only | no finding closure or certification claim |
| Authority verification | tracked Dashboard authority bytes | manifest/check output only | mismatch fails without rewriting expected digests |
| Artifact verification | artifact, Sigstore bundle, Rekor inclusion, frozen policy | payload-free receipt only | wrong/stale/unpinned evidence cannot update a lock or pointer |
| Dashboard delivery | frozen verified tree | commit/push/PR only after explicit user instruction | no automatic publication or merge |
| Backend pointer | merged Dashboard commit/package plus backend lock catalog | backend pointer/index/docs/tests only | no Dashboard rewrite and no accepted lock-manifest drift |
| Remote/runtime branches | none | none | Supabase/Auth/deploy/provider/paid/customer operations remain prohibited |

## Trust and artifact-attestation matrix

| Representation | Trust source | Required binding | Failure |
|---|---|---|---|
| Accepted source note | source SHA-256 above | one unique vault-relative file | stop migration |
| Migrated authority file | tracked Dashboard bytes | path plus SHA-256 in package manifest | fail closed |
| Authority package | canonical sorted path/digest list | manifest `packageSha256` content-set digest, Dashboard commit, and separately pinned archive SHA-256/release asset identity if published | reject |
| Sigstore bundle | Fulcio certificate plus signature | subject digest and GitHub OIDC identity | reject |
| Rekor evidence | public transparency service | UUID, integrated time, inclusion proof/checkpoint | reject |
| Signer identity | GitHub Actions OIDC | exact repository, workflow path, tag ref, and source commit | reject |
| Verifier | Cosign `v3.1.3` | pinned version and verified binary digest | reject |
| Release asset | immutable release record | exact tag, asset ID, digest, and immutability evidence | reject replacement/mutable asset |
| Backend pointer | backend tracked manifest | exact Dashboard repository, commit, path, and package digest | fail handoff |
| Repository governance | GitHub settings plus CODEOWNERS/CI evidence | `SEC-2026-012` remains open under the approved GitHub Free waiver | readiness remains blocked |

Public Rekor receives signature metadata and digests, never authority contents,
secrets, source/customer payloads, or generated private runtime output.

## Frozen Auth/session boundary

- JWT: `15m`.
- Visible-tab human-activity idle expiry: `30m`; warn at `5m`.
- Successful activity touch coalescing: `1m`.
- Absolute application session: `8h`.
- Concurrent sessions: maximum three; replace oldest with explicit notice.
- One-time dangerous-operation reauthentication: `10m`.
- Email OTP lifetime: `10m`; resend cooldown: `60s`.
- Return after sign-in only to the previously authorized Knowledge route and
  never replay an unconfirmed mutation.
- Assets, prefetch, polling, an untouched tab, and token refresh are not human
  activity.

## EEM-3 global lock inventory

The executable source is the merged backend manifest at:

`services/model-orchestration/tests/database/fixtures/eem3_global_lock_contract.v1.json`

Its frozen manifest and catalog digests are:

- manifest file:
  `ff422f622d60f43e41bb78e77a01c665b0dd100b80b701f71296c88486956f8d`;
- function catalog:
  `32bd9e26482b2d9398d2fab5eaa889817b666a8880d97abc71185fae7720d45c`;
- trigger catalog:
  `585f0d63c7177fb3486ee0904899b1445cd363aca0ba5dbe6da84e050a6bc287`;
- foreign-key catalog:
  `03bf2568291f3bb196020cd95a35c54d022b0567d6410d4d0ab7e17b954306bc`;
- foreign-key-trigger catalog:
  `2a9cc1fbfeaa26b0c73a2e4d5033a68017925ecb3c0c4b1dd9fb64920a589f33`.

Global acquisition order:

1. `0a` maintenance/retention advisory and scheduler history;
2. `0b` webhook-delivery advisory and PGMQ ownership;
3. `1a` application session, `1b` platform operator, `1c` organization and
   membership guards;
4. `2a–2b` GitHub installation, repository, and access;
5. `3–4` organization limits/slots, entitlement/generation/policy;
6. `5` semantic-fingerprint advisory;
7. `6` backfill runs, then `7` backfill items in
   `(backfill_run_id UUID, id bigint)` order;
8. `8a` PR-admission advisory, then `8b` pull request;
9. `9` source-recovery advisory, then `10` complete current/effective/alias job
   set in PostgreSQL UUID order;
10. `11a–11i` consent/authorization placeholders, execution, dispatch,
    checkpoint, extraction/model/validation/admission, and retention targets;
11. `12a–12b` repository budget usage and already-held run/job settlement;
12. `13` relation graph advisory, `14` Knowledge Objects, and `15`
    review/lifecycle/relation/correction;
13. `16a–16e` queue/archive, receipt, event, audit, then outbox.

No operation may acquire a new lower rank after a higher rank. Exact already
held key revisits are the only exception. Multi-row sets use stable ordering,
and mutable facts are rechecked after the final prerequisite lock. Runtime DDL,
runtime `LOCK TABLE`, dynamic SQL in a lock-bearing path, and unproved
multi-rank `FOR UPDATE OF` are forbidden.

The paired backend PR must rerun the merged executable attestation. Any digest,
function/trigger/FK/advisory/recheck, rank, or branch-expansion drift is a
blocker and must not be accepted by regenerating the manifest.

## Acceptance and executable evidence map

| Row | Contract | Dashboard evidence | Backend evidence |
|---|---|---|---|
| `P01-A001` | exact merged prerequisite and preserved initial history | authority manifest/checker | PR #24/tree/lock attestation |
| `P01-A002` | three accepted notes migrated with source digests and links | docs checker/source manifest | stable source locators |
| `P01-A003` | every requirement `.A<n>` has one immutable primary owner/test | acceptance-map generator/checker | EEM-4/EEM-6–8 ownership sources |
| `P01-A004` | every selected ASVS L2 row has owner/evidence/environment/verifier/rationale | ASVS matrix checker | security contributor locators |
| `P01-A005` | no broken/deleted/local-absolute authority link | `scripts/check_docs.py` | backend pointer check |
| `P01-A006` | deterministic immutable authority package | manifest verifier | exact package digest in pointer |
| `P01-A007` | replacement, mutable tag, wrong repo/workflow/ref/issuer/digest, stale policy, and unpinned verifier reject | artifact-policy negative tests | pointer/attestation verifier |
| `P01-A008` | repository rules and temporary governance waiver are explicit | `AGENTS.md`, `SECURITY.md`, CODEOWNERS/CI checks | `SEC-2026-012` remains open |
| `P01-A009` | Auth/session thresholds and no-activity classes are frozen | architecture and acceptance checks | future EEM-4 contract owner |
| `P01-A010` | merged global lock graph remains non-contradictory | frozen inventory/digests | live PG17 catalog attestation |
| `P01-A011` | backend stable pointer binds Dashboard commit/path/package | post-merge handoff fixture | backend machine-readable pointer |
| `P01-A012` | both repositories expose the same `/01–/10` catalog and reading map | Dashboard catalog checker | backend catalog/pointer checker |
| `P01-A013` | no runtime or remote state change | tracked-path allowlist | backend diff/operation audit |

The full product acceptance map preserves `G-*`, `J-*`, `AUTH-*`, `GH-*`,
`ENT-*`, `REPO-*`, `BF-*`, `MEM-*`, `KD-*`, `REV-*`, `LIFE-*`, `PR-*`,
`PROC-*`, `SET-*`, `OPS-*`, `MET-*`, `BR-*`, and `NFR-*` rows. Stable
`SEC-WEB-001` through `SEC-WEB-012` remain separate security rows.

## Gates and rerun triggers

Focused Dashboard gate:

```text
python3 -m unittest tests.test_bootstrap_contract
python3 scripts/check_docs.py
python3 scripts/check_authority.py
```

Affected Dashboard gate adds all bootstrap tests, acceptance/ASVS completeness,
artifact-policy negative fixtures, workflow/CODEOWNERS policy checks, and a
tracked-secret scan.

Final free Dashboard gate runs the complete standard-library test suite,
documentation and authority checkers, unresolved-marker/path scans, workflow
syntax/pin checks, and available local Gitleaks scanning. It performs no
network publication, signing, release, provider, Supabase, deployment, paid,
or customer-data action.

Rerun rules:

- changed migrated authority bytes rerun docs, acceptance, package, and
  artifact-policy gates;
- changed ownership/acceptance generator reruns all acceptance completeness
  tests;
- changed ASVS source/policy reruns ASVS and security ownership tests;
- changed workflow/action/tool pin reruns supply-chain and attestation tests;
- docs-only copy after frozen product bytes reruns link/manifest checks only;
- the later backend pointer or EEM-3 manifest change reruns the backend
  attestation and cross-repository pointer checks, not unrelated Dashboard
  runtime gates.

One complete-diff audit and, if required, one independent review wave run
against frozen bytes. Commit, push, PR creation, merge, release, or signing
requires the separately applicable authorization.
