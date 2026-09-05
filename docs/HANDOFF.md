# Dashboard handoff

Updated: 2026-09-05

## Current state

- Active branch: `EEM-9/06-processing-settings-metrics`. EEM-9/06 blocked
  surfaces are implemented and locally verified; not merged, no pull request
  open yet.
- Prerequisite `EEM-9/03h-console-contract-revision` consumes
  `console-contract-v1.0.4` (invitation inventory, typed receipts, processing
  identifiers, offboarding wrapper).
- The Console contract lock pins `console-contract-v1.0.4` at source commit
  `b4011580a822e378863cac0d67a9b5358872b986`.

## What changed here and why

- **Processing and settings surfaces** — read-only processing activity, usage
  and metrics, GitHub settings summary, members invitations and role changes,
  offboarding request, and PR detail linked from processing rows.
- **Stub and BFF** — contract-shaped fixtures and routes for
  `processingSettings` scenarios; membership mutations wired through shared
  step-up replay.
- **Navigation capabilities** — corrected to `organization.github.manage` and
  `organization.usage.read`.

Trace: [`eem-9-06-acceptance-trace.md`](plans/active/eem-9-06-acceptance-trace.md).

## Security and release state

- No provider was called, no paid operation was authorized, no worker ran, no
  hosted Supabase setting was read or changed, and nothing was deployed.
- Network use was limited to downloading published release assets, Rekor
  metadata for the evidence UUID, and a pinned cosign binary; verification ran
  offline.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness blocking.
- Technical Design Partner Ready remains blocked.

## Verification and next action

Prepare the pull request for `EEM-9/03h-console-contract-revision`. After merge,
rebase `EEM-9/06-processing-settings-metrics` onto updated `main`, pop stash
`eem-9-06-wip`, and finish PR detail, members step-up mutations, and offboarding
request.
