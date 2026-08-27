# ADR-0001: two-repository contract boundary

Status: accepted
Date: 2026-08-25
Transferred: 2026-08-27 under EEM-9/01

## Context

The Console and backend have different release cadences and security
boundaries. The browser must not become a database client, policy source,
provider caller, or holder of backend/operator credentials. At the same time,
independent repositories create a risk that generated clients, acceptance
ownership, and operational behavior silently drift.

## Decision

The Dashboard repository owns the Next.js UI, server-only BFF, browser
security, generated customer-safe client, Console deployment, and Dashboard
evidence.

The backend repository owns persistence, RLS, tenancy, platform policy,
entitlements, workers, review/lifecycle state, observability, provider calls,
paid authorization, customer-safe API behavior, and the EEM-3 global lock
order.

The repositories integrate only through an immutable contract artifact:

1. backend generates deterministic OpenAPI, schema, runtime validators,
   examples, error taxonomy, build metadata, and digest manifest;
2. a protected tag workflow signs exact bytes through GitHub Actions OIDC,
   public Fulcio, and public Rekor;
3. Dashboard downloads an exact release asset using a short-lived credential;
4. Dashboard verifies digest, signer repository/workflow/ref/commit, issuer,
   Rekor inclusion, release asset identity, and pinned verifier before extract;
5. generated code records the backend commit and artifact digest;
6. CI fails closed on any mismatch, replacement, stale artifact, or handwritten
   duplicate contract type.

EEM-9/01 uses the same mechanism for the Dashboard authority package. Its
Dashboard PR merges first; a paired backend PR then pins the exact Dashboard
commit, manifest path, package digest, reading map, and task catalog.

## Consequences

- Mutable branches and network-fetched latest artifacts are not authorities.
- Browser code cannot directly query Supabase or backend persistence.
- Backend API change, validator change, generated-client change, and
  Dashboard behavior change remain separately reviewable.
- Contract consumers need a deterministic offline verification path and
  negative trust-substitution tests.
- Public transparency metadata is permitted, but authority contents, customer
  data, secrets, and raw runtime outputs are prohibited from public Rekor.
- Repository and immutable-release enforcement evidence remains a release
  prerequisite. The temporary GitHub Free bootstrap waiver is tracked as
  `SEC-2026-012` and blocks readiness.

## Alternatives rejected

- One repository for UI and backend: rejected because it couples release and
  permission boundaries without removing the browser trust risk.
- Dashboard reading backend tables directly: rejected because it duplicates
  authorization and bypasses the customer-safe API boundary.
- Mutable branch or tag archives: rejected because they cannot prove exact
  reviewed bytes.
- Long-lived personal access tokens: rejected because short-lived,
  minimum-scope credentials are available.
