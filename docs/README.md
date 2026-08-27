# Dashboard documentation

## Current state and delivery

- [Handoff](HANDOFF.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Active task catalog](plans/active/README.md)
- [EEM-9 execution plan](plans/active/eem-9-design-partner-console-dashboard-and-certification.md)
- [EEM-9/01 bootstrap contract](plans/eem-9-01-bootstrap-contract.md)

## Product and architecture

- [Accepted Console requirements](product/design-partner-console-requirements.md)
- [Console architecture](architecture/design-partner-console.md)
- [Portable program design](architecture/design-partner-console-program-design.md)
- [Implementation plan](plans/design-partner-console-implementation.md)
- [Toolchain and boundary baseline](architecture/toolchain-baseline.json)

## Acceptance and security

- [Stable acceptance map](requirements/acceptance-map.yaml)
- [Frozen ownership map](requirements/ownership.json)
- [Source disposition](requirements/source-disposition.yaml)
- [ASVS notice](security/ASVS-NOTICE.md)
- [ASVS source subset](security/asvs-v5.0.0-l2-source.json)
- [ASVS ownership/evidence matrix](security/asvs-v5.0.0-l2-console-evidence.yaml)
- [Stable Console security controls](security/console-security-controls.yaml)
- [Artifact attestation policy](security/artifact-attestation.md)
- [Machine-readable trust policy](security/artifact-attestation-policy.json)

## Decisions

- [Decision index](decisions/README.md)
- [Two-repository contract boundary](decisions/0001-two-repository-contract-boundary.md)

Repository copies are source-controlled authorities only at the exact commit
and package digest pinned by the paired backend EEM-9/01 pointer. Retained
Obsidian security and operations sources remain mandatory for their assigned
tasks and are identified by URI plus vault-relative fallback, never an absolute
local path.
