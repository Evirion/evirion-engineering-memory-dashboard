# Evirion Engineering Memory Dashboard

Private source repository for the Design Partner Console. EEM-9/01 contains
authority, governance, security ownership, and immutable contract-attestation
infrastructure only; it intentionally contains no UI or runtime scaffold.

Start with:

- [agent rules](AGENTS.md);
- [current handoff](docs/HANDOFF.md);
- [roadmap](docs/ROADMAP.md);
- [documentation index](docs/README.md);
- [active task catalog](docs/plans/active/README.md);
- [security policy](SECURITY.md).

The backend repository remains authoritative for database and service behavior.
This repository becomes authoritative for the Dashboard only after the
Dashboard EEM-9/01 PR merges and the paired backend stable-pointer PR pins that
exact commit and authority package digest.

No runtime, hosted Auth, deployment, provider, paid, or customer-data action is
part of this bootstrap.
