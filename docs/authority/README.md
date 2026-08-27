# Dashboard authority package

The EEM-9/01 authority package binds the accepted Console requirements,
architecture, execution plan, acceptance ownership, ASVS ownership, security
policy, task catalog, source disposition, EEM-3 global-lock input, governance,
and executable offline verification.

Files are enumerated in `package-files.json`. `manifest.json` records each
tracked path and SHA-256 plus a deterministic digest of the ordered path/digest
list under the historical field name `packageSha256`. That value is the
content-set digest, not the SHA-256 of the compressed archive. The manifest
does not hash itself; the release archive contains the manifest and exactly
its listed payload. A separately authorized release must independently pin and
attest the resulting archive SHA-256.

Generate after authority bytes are frozen:

```text
python3 scripts/check_authority.py --write
```

Verify without rewriting expected values:

```text
python3 scripts/check_authority.py
python3 -m scripts.build_authority_package --output /tmp/dashboard-authority.tar.gz
```

The release archive uses sorted paths, zero timestamps, numeric owner/group
zero, empty owner/group names, mode `0644`, USTAR format, and gzip timestamp
zero. The protected release workflow builds it twice and requires byte equality
before signing.

The paired backend EEM-9/01 PR must pin:

- repository `Evirion/evirion-engineering-memory-dashboard`;
- exact merged Dashboard commit;
- this manifest path;
- manifest `packageSha256` content-set digest;
- if an authority release is separately authorized and published, its exact
  tag, asset ID/name, archive SHA-256, and policy digest;
- exact EEM-9 reading-map and task-catalog paths;
- source-manifest digest;
- unchanged EEM-3 lock-input digest and a fresh executable backend lock
  attestation.

Any mismatch blocks the handoff. Never regenerate the expected consumer pointer
to accept unexplained drift.
