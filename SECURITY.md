# Security policy

## Reporting

Report suspected vulnerabilities privately through the repository's GitHub
Security Advisory interface. Do not include secrets, customer payloads, source
envelopes, model responses, credentials, or production evidence in a public
issue.

## Bootstrap security boundary

EEM-9/01 publishes no application runtime and processes no customer data. Its
security surface is the integrity of requirements, architecture, acceptance
ownership, release policy, and the future backend contract lock.

Authority and contract consumers must:

1. download an exact release asset, never a mutable branch archive;
2. verify the independently pinned SHA-256, policy digest, release tag, release
   asset ID, and source commit;
3. verify the Sigstore bundle against the exact repository, workflow, tag ref,
   source commit, `push` trigger, and public GitHub Actions OIDC issuer;
4. verify Rekor inclusion;
5. verify the release asset ID and immutable-release evidence;
6. verify the pinned Cosign version and binary digest;
7. reject missing, stale, replaced, ambiguously owned, or mismatched evidence.

Public Rekor may receive signature metadata, identities, timestamps, and
digests. Authority contents, secrets, customer payloads, raw source, raw model
responses, and private generated runtime output must never be submitted.

The full policy is
[`docs/security/artifact-attestation-policy.json`](docs/security/artifact-attestation-policy.json).

## Open governance finding

`SEC-2026-012` remains open. The repository is private on GitHub Free, whose API
currently rejects repository rulesets for this repository. The user approved a
temporary bootstrap waiver with full-SHA action pins, deterministic manifests,
CODEOWNERS, local/CI checks, public Sigstore/Rekor identity binding, and the
paired backend digest lock as compensating controls.

This waiver does not assert protected-branch enforcement and does not permit a
consumable release unless immutable-release evidence is available. The finding
blocks Technical Design Partner Ready until branch/ruleset and release
protection are enforced and recorded.

## Future runtime invariants

- Browser JavaScript never receives provider, database, GitHub App, operator,
  `service_role`, access-token, or refresh-token secrets.
- Host-scoped `__Host-` cookies are `HttpOnly; Secure; SameSite=Lax; Path=/`
  with no `Domain`.
- Every customer operation is tenant- and capability-authorized by the backend.
- State-changing requests fail closed on origin, proxy, CSRF, content type,
  unsupported state, and idempotency errors.
- Runtime secrets and customer data are prohibited from logs, fixtures,
  screenshots, docs, release assets, and public transparency services.
