# ADR-0004: Console lint and format toolchain under TypeScript 7

Status: accepted
Date: 2026-09-02
Owners: EEM-9/02 (phase C01)

## Context

`docs/architecture/toolchain-baseline.json` pins `typescript` at `7.0.2`, and
that pin is binding. Implementation task C01 step 2 requires the scaffold to
enable "linting", and the ecosystem default for a Next.js App Router project is
ESLint with `eslint-config-next`.

TypeScript 7 is the native compiler, and it does not ship the JavaScript
compiler API that ESLint's TypeScript support is built on. Observed on the
pinned version:

- the package main entry resolves to `lib/version.cjs`, and
  `require("typescript")` exposes exactly `version` and `versionMajorMinor`.
  `createProgram` and the rest of the classic API are absent, and the package
  ships no `lib.*.d.ts` files;
- the remaining surface is a set of `./unstable/*` subpath exports;
- `typescript-eslint@8.69.0` and `@typescript-eslint/parser@8.69.0` both declare
  the peer range `typescript >=4.8.4 <6.1.0`;
- `eslint-config-next@16.3.4` depends on `typescript-eslint ^8.46.0`.

So `eslint-config-next` cannot parse TypeScript under the pinned compiler. This
is a capability fact, not a version-range formality.

What does work under `typescript@7.0.2` was verified before choosing:
`tsc --noEmit` typechecks the App Router project, and `next build` completes
including its own "Running TypeScript" step.

## Decision

Typechecking uses the pinned `tsc --noEmit`, and `next build` keeps
`typescript.ignoreBuildErrors: false` so the framework's own check also runs.

Linting uses `oxlint`, which parses TypeScript itself and needs no compiler
API. It carries the React, Next.js, JSX accessibility, TypeScript, import and
unicorn rule sets, and it enforces the prohibitions this program actually
depends on, including `react/no-danger` for `dangerouslySetInnerHTML`, which
`NFR-SEC-003` forbids outright.

Formatting uses `prettier` with `semi: false`, which satisfies the
`front-end-cursor-rules` no-semicolon requirement as committed configuration
rather than as review guidance. Prettier bundles its own TypeScript parser and
is unaffected by the compiler pin.

Type-aware lint rules are not available. The checks that would have depended on
them are covered instead by `tsc` under `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` and `noFallthroughCasesInSwitch`, and by the
Semgrep rules in `tools/security/semgrep.yml`, which assert the security
prohibitions directly rather than inferring them from types.

`oxlint`, `prettier` and the other tools this task selected are recorded in the
baseline `packages` block, and the reason ESLint is absent is recorded in its
`linting` block, so a future reader does not rediscover this by trying.

## Consequences

- A rule that genuinely requires type information cannot be expressed in the
  linter. Semgrep and the compiler carry those cases.
- `eslint-config-next` is unavailable, so Next-specific lint coverage comes from
  oxlint's `nextjs` plugin instead.
- If a later subtask needs type-aware linting, the choice is between waiting for
  typescript-eslint to support TypeScript 7 and adding a second TypeScript
  version purely for the linter. The second option is rejected in advance:
  linting against a different compiler than the one that builds the product
  would make the lint result unsound.
- Generated contract code under `generated/console-contract/` is excluded from
  both the formatter and the linter, because those files are digest-pinned
  manifest members that CI reproduces and compares byte for byte.

## Alternatives rejected

- **Downgrading TypeScript to 6.x.** The baseline pin is binding and was set by
  EEM-9/01 after checking supported releases. Changing it is a successor-pointer
  decision, not an implementation convenience.
- **Installing a second, aliased TypeScript 5.x for the linter only.** Restores
  `eslint-config-next` and makes the linter reason about a different compiler
  than the one that type-checks and builds the product.
- **Skipping linting until the ecosystem catches up.** C01 requires it, and the
  rules that matter most here are security prohibitions rather than style.
- **Biome instead of oxlint.** Equally free of the compiler API, but it would
  also replace Prettier, and Prettier already satisfies the no-semicolon
  requirement with a configuration the front-end rule names directly.
