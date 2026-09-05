# Dashboard handoff

Updated: 2026-09-05

## Current state

- Active branch: `EEM-9/07-free-integration`. Console `I01-C` is implemented and
  locally verified; not merged, no pull request open, nothing pushed.
- `main` is at `0c327bb`, which merged EEM-9/06 through
  [PR #22](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/22).
  `EEM-9/03h` and `EEM-9/02c` are merged; text here previously asked for an
  `EEM-9/03h` pull request and a rebase of `EEM-9/06`, both of which had already
  landed, and EEM-9/07 corrected it against Git rather than leaving the next
  reader to discover it.
- The Console contract lock pins `console-contract-v1.0.4` at backend source
  commit `b4011580`. That release is tagged, signed and published.
- The paired backend `I01-B` is merged through
  [PR #73](https://github.com/Evirion/evirion-engineering-memory/pull/73) at
  `aa5bd83`. It moved no contract or migration byte, so no contract publication
  was needed between the two pull requests.

## What changed here and why

EEM-9/07 is the first task where the Console and the backend are exercised
against each other rather than each against its own reading of the contract.

- **Conformance tier** — the double knew 32 of the 38 error codes a Console
  surface can receive, so six refusals could never be exercised by any test.
  They are closed, and an unknown code now throws instead of becoming a 500.
- **Nine security and journey suites** — `SEC-WEB-001`, `004`, `008`, `009`,
  `NFR-SEC-003`, `NFR-ACC-001`, `AUTH-009`, `G-001` and ASVS V10.
- **The gate is executable as specified** — five Step 6 scripts did not exist,
  and OWASP ZAP is now pinned by index digest rather than by tag.
- **The ASVS matrix can now pass** — every row named a synthesised case that
  existed in no suite, which is why all 212 read `planned`.
- **Rollback rehearsal** — one profile drives both repositories identically.

Trace: [`eem-9-07-acceptance-trace.md`](plans/active/eem-9-07-acceptance-trace.md).

## Security and release state

- No provider was called, no paid operation authorized, no worker run, no hosted
  Supabase setting read or changed, and nothing deployed.
- Network use was limited to fetching the pinned Node runtime and the
  digest-pinned OWASP ZAP image, both checksum or digest verified.
- The baseline DAST scanned only the local production build: 60 rules pass,
  7 warnings, nothing at High or above.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness blocking.
- Technical Design Partner Ready remains blocked.

## Verification and next action

`pnpm verify` exits `0` on the pinned Node 24.20.0 runtime, ending
`complete free gate passed`: 839 unit, contract and conformance tests, 336
end-to-end and security tests, and the baseline DAST.

Next: review and open the `I01-C` pull request. After it merges, Step 7 needs an
explicit authorization naming the project, artifacts, migrations, flags,
rollback owner, stop conditions and evidence window; planning it is not
receiving it.

Two things are recorded for whoever picks this up. `error.json` is shared with
the operator contract, so the generated Console validator accepts two codes no
Console surface can receive; narrowing it is a contract change neither pull
request owns. And the ASVS status is suite level, not row level — a `pass` means
the named suite exists and passed, not that a separate assertion was written for
that single requirement.
