# ADR-0003: application-source boundary and the resolving-route contract

Status: accepted
Date: 2026-09-02
Owners: EEM-9/02 (phase C00)

## Context

EEM-9/02 is the first subtask that puts a running application into this
repository. Three EEM-9/01 artifacts were built when the repository held nothing
but authority documents, and each one breaks in a different way once
`src/app/page.tsx` exists. All three are owner-authorized additions to this
subtask, taken before any screen, because doing them afterwards means unpicking
hundreds of files.

**The authority package was the whole repository.** `docs/authority/package-files.json`
and `docs/authority/manifest.json` held the same 84 entries with no difference in
either direction, and `scripts/check_authority.py` raised `unlisted authority
files` for any tracked path outside that inventory. Every scaffold file therefore
had exactly two possible fates: enter the reviewed authority package, or break
the authority gate. In the first case `packageSha256` stops meaning "the reviewed
authority" and starts meaning "a snapshot of the repository", so the backend
stable pointer that pins it would move on every UI commit.

**The bootstrap guard asserted the absence of the thing this task builds.**
`tests/test_bootstrap_contract.py::test_no_dashboard_runtime_scaffold_exists_in_bootstrap`
asserted that `app`, `src`, `package.json`, `next.config.js`, `next.config.mjs`,
`next.config.ts` and `supabase` do not exist. It was an EEM-9/01 acceptance row
proving the bootstrap carried no runtime. Deleting it would make that row
vacuous and would silently drop the one prohibition that never expires.

**Two frozen documents disagreed about route paths.** The EEM-9 plan freezes
exact App Router paths from requirements Section 10, including `/auth/*`. The
accepted implementation plan's C02 file list names
`src/app/(auth)/sign-in/page.tsx`. A parenthesised route group contributes no
URL segment, so that file serves `/sign-in`. The same list names
`src/app/(console)/settings/sessions/page.tsx`, a fourteenth path that
Section 10 does not contain. Both documents are frozen manifest members, so
neither could be edited to resolve the disagreement.

## Decision

### The authority package keeps its 84 entries; the rule changes instead

Every current entry stays packaged. They are authority documents, verification
scripts, executable tests and workflows, and removing any of them is a separate
decision. `validate_inventory` gains a reviewed allowlist of non-package tracked
paths, `docs/authority/non-package-paths.json`. Every tracked file now belongs to
exactly one side:

- packaged and not allowlisted: reviewed authority, unchanged behavior;
- allowlisted and not packaged: application source, tracked and outside the
  package;
- in neither: still `unlisted authority files`, so nothing is smuggled in by
  omission;
- in both: a new failure, because an ambiguous path has no defined digest
  meaning;
- an allowlist pattern matching nothing: a new failure, so dead patterns cannot
  accumulate as the application changes shape.

A pattern is an exact relative POSIX path or a `directory/**` prefix. Absolute
paths, `..` and symlinks stay rejected.

The allowlist admits the Next.js application and the files that only exist to
build, type, lint, format and test it: `package.json`, the pnpm lockfile and
workspace file, `.nvmrc`, `.npmrc`, the Next, TypeScript, Vitest, Playwright,
ESLint, Prettier and PostCSS configuration, everything under `src`, the
TypeScript test directories under `tests`, and the local TLS harness.

It deliberately does not admit gates. `.github/workflows/ci.yml`,
`tools/security/**`, `scripts/security/**` and `scripts/console_test_slices.json`
stay packaged, because they are the verification contract rather than the thing
being verified, and they do not move when a screen changes.

The allowlist ships empty in the commit that introduces the rule, and each entry
lands in the same reviewed commit as the files it covers. A red authority gate
would block manifest regeneration, so the mechanism must precede the first
scaffold file without pre-declaring paths that do not yet exist.

### Six prohibitions expire; one is permanent

The guard is replaced, not deleted. `app`, `src`, `package.json`,
`next.config.js`, `next.config.mjs` and `next.config.ts` were prohibited only
because the bootstrap carried no runtime. EEM-9/02 is the subtask that creates
the runtime, so those six expire here.

`supabase` does not expire and is not scoped to bootstrap. The backend owns
persistence, migrations, RLS, tenancy and the Auth project. A Supabase project
in this repository would be a second source of truth for state the backend is
authoritative for, which ADR-0001 rules out. It keeps its own named test so that
removing it requires deleting an assertion rather than editing a list.

### The replacement guard checks resolving URLs

The assertion that matters from now on is that the scaffold exists, that its App
Router paths are exactly the reviewed set and no others, and that `supabase` is
still absent. It is expressed against the URLs Next.js actually resolves, not
against folder names on disk: route groups are dropped, `[param]` becomes
`:param`, private `_folders` are unrouted and a parallel-route slot is rejected
outright because the inventory cannot express it.

`docs/architecture/console-route-inventory.json` holds three lists. `frozenPaths`
is the thirteen from Section 10 and is itself asserted, so the freeze cannot be
widened silently. `declaredRoutes` holds paths outside the freeze, each with an
owner and a rationale. `present` pins the exact resolving page URLs that must
exist right now; later subtasks widen it as an acceptance row.

`/api/*` is not pinned. A wrong BFF URL fails loudly in the first test that
fetches it, Section 10 admits those routes generically rather than enumerating
them, and an exact pin would churn on ordinary work until the habit of updating
it mechanically carried over to the page pin, which is the guard that catches a
silent failure. The single assertion added is that every route handler resolves
under `/api/`, which closes the real gap of a handler outside that prefix.
Endpoint properties stay owned by the browser-secret, header-cache and
release-surface suites, which assert properties of every endpoint rather than a
list of names.

### The URL contract binds; the C02 file list is layout guidance

`/auth/sign-in`, `/auth/invite` and `/auth/verify` are served from real
directory segments under a shared `src/app/auth/layout.tsx`, with no route
group. Requirements Section 10 lists `/auth/*` and the plan freezes it as an
exact path taken from that section; no document anywhere states `/sign-in` as a
route. The C02 file list is a Next.js semantics slip rather than a competing
decision.

A group plus a literal `auth` segment was rejected. It resolves correctly today
and reproduces the ambiguity that caused the conflict, because the next file
added inside the group silently loses the prefix again. `(console)` is retained
for `/onboarding` and `/settings/sessions`, which share a layout but no URL
prefix, which is what a group is for.

`/settings/sessions` is accepted as a reviewed fourteenth path. It is the
principal's own application-session inventory required by AUTH-007 and AUTH-008,
it exposes no member roster, and relocating it under `/auth/*` would put a
post-authentication surface behind a pre-authentication prefix.

`/` is a declared owned route rather than an incidental scaffold artifact,
because it resolves, it is reachable, and an unreviewed root is exactly the kind
of path this guard exists to catch. It carries no customer data.

### C01 Step 7 is satisfied by existing artifacts

C01 Step 7 asks for the contract digest at `src/lib/contracts/contract-lock.json`
and generated code under `src/lib/contracts/generated/`. EEM-9/01b already
delivered both at different paths: `docs/contracts/console-contract-lock.json`
and `generated/console-contract/v1/`, whose `CONSOLE_CONTRACT_PROVENANCE` records
the release, asset, archive digest, contract `packageSha256` and source commit.
Those are attestation-verified, reproduced by CI and pinned by the trust policy.
They are consumed through a TypeScript path alias and are not copied, because a
second copy would be a handwritten duplicate contract surface, which the plan
forbids. A contract test asserts the generated provenance still agrees with the
lock.

## Consequences

- `packageSha256` moves for this subtask, as it does for any authority change.
  Whether a paired backend successor pointer follows is an owner decision taken
  on that value. The pointer keeps verifying either way, because it reads the
  pinned commit rather than Dashboard `main`.
- After this commit, `packageSha256` no longer moves when application source
  changes, which is the property the backend pointer depends on.
- Adding a Console route is a reviewed change to a machine-checked inventory,
  not an implicit consequence of creating a directory.
- The route guard is red between the commit that declares the inventory and the
  commit that creates the scaffold. That is the intended RED/GREEN order: the
  acceptance row is written before the implementation it constrains.
- `generated/console-contract/` must stay outside every formatter and linter
  write path, or the reproduction check fails.

## Alternatives rejected

- **Deleting the bootstrap guard.** Simplest, and it discards the one
  prohibition that never expires while making an EEM-9/01 acceptance row
  vacuous. Nobody could later distinguish a reviewed replacement from a deleted
  inconvenient test.
- **Packaging the application source.** Keeps one list and turns the reviewed
  authority digest into a repository snapshot, so the backend pointer would need
  re-pinning on every UI commit and would stop meaning anything.
- **Dropping paths from the package to make room.** Every one of the 84 entries
  is authority. Removing any is a separate decision and none of them is the
  cause of this problem.
- **Asserting folder names instead of URLs.** Cheaper, and it cannot see the
  failure it exists to catch: `(auth)/sign-in` passes a folder-name check and
  serves the wrong URL.
- **Requiring all thirteen frozen routes to exist immediately.** Contradicts the
  EEM-9/02 exclusions, which assign the repository, import, knowledge, member
  and settings pages to later subtasks.
- **Pinning the exact `/api/*` inventory.** Freezes an implementation list that
  no document froze, churns on ordinary work, and trains reviewers to update
  pins mechanically.
- **Editing the implementation plan or the EEM-9 plan to remove the conflict.**
  Both are frozen manifest members; changing either requires a reviewed
  successor pointer and a paired backend pull request.
