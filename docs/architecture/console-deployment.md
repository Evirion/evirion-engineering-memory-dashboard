# Console deployment requirements

What a hosted Console needs before it may hold a real session. Nothing here is
an authorization to deploy, and no deployment has happened.

The host decision and its reasoning are in backend
[ADR 0019](https://github.com/Evirion/evirion-engineering-memory/blob/main/docs/decisions/0019-console-needs-a-server-host.md):
the Console is server code, so static hosting would require moving the session
into the browser, which the security rules forbid outright.

## Server-only environment

`src/lib/env/server.ts` fails closed on every one of these. A missing or
malformed value stops the server rather than degrading it.

| variable | constraint |
| --- | --- |
| `SUPABASE_URL` | must parse as `https:` |
| `SUPABASE_PUBLISHABLE_KEY` | non-empty; the publishable key only, never `service_role` |
| `CONSOLE_API_BASE_URL` | must parse as `https:`; the backend Console API |
| `CONSOLE_GITHUB_APP_INSTALL_URL` | must parse as `https:` |
| `CONSOLE_CANONICAL_ORIGIN` | exactly one origin, no path, query or fragment |
| `CONSOLE_TRUSTED_PROXY_HOPS` | exactly `1`; any other value is refused |
| `CONSOLE_CSRF_SIGNING_KEY` | generated secret, never committed |
| `CONSOLE_BFF_PROOF_SIGNING_KEY` | generated secret, never committed |
| `NODE_ENV` | `production` |

Only `NEXT_PUBLIC_CONSOLE_ENVIRONMENT` reaches the browser, and it carries an
environment label rather than a secret. Nothing else may gain a `NEXT_PUBLIC_`
prefix: that is the boundary keeping Supabase tokens out of browser JavaScript.

`CONSOLE_ALLOW_STUB_AUTH` must be unset. Stub auth is enabled when `NODE_ENV`
is not `production`, so a deployment that fails to set `NODE_ENV` gets a
sign-in path that trusts a fixture.

## The trusted edge hop

The CSRF and origin boundary trusts `X-Forwarded-*` only because exactly one
edge is assumed to strip whatever the client sent and write canonical values.
The local terminator in `tools/local-tls/edge.mjs` deletes `forwarded`,
`x-forwarded-for`, `x-forwarded-host`, `x-forwarded-proto` and
`x-forwarded-port` before writing its own, which is what makes the assumption
true locally.

Vercel overwrites client-supplied `X-Forwarded-Host` and `X-Forwarded-Proto`
with its own origin values before the runtime sees them, so the same assumption
holds there. This is well attested in the opposite direction: teams putting an
external proxy in front of Vercel report that they *cannot* preserve the
original host, precisely because Vercel normalizes it.

Two consequences follow, and both are load-bearing:

1. `CONSOLE_CANONICAL_ORIGIN` must equal the origin Vercel reports, which is the
   origin the browser used when Vercel is the only edge.
2. **Putting another CDN or proxy in front of Vercel breaks the model.** The
   application would then be trusting values written by Vercel about a hop that
   is no longer the edge, and `CONSOLE_TRUSTED_PROXY_HOPS` would be wrong at 1
   while no other value is accepted. Do not add a fronting proxy without
   revisiting this boundary.

**Verified against the deployment on 2026-09-05, not argued from documentation.**
Every forged forwarding header was ignored: `x-forwarded-host: evil.example`,
`x-forwarded-proto: http` and `forwarded: host=evil.example` each produced a
redirect to `https://evirion-engineering-memory-dashboard.vercel.app`, the
canonical origin, and never to the forged host. A forged `Origin`, a forged
`Origin` combined with a matching forged `x-forwarded-host`, and a request with
no `Origin` at all were each refused.

One limit is worth stating rather than glossing: those probes ran without a
session, so every path was refused and the probe cannot separate an
origin refusal from a session refusal. What it does establish is that no
combination of forged headers reached a different outcome, and that no forged
host ever entered a redirect target, which is the open-redirect class this
boundary exists to prevent.

`tests/security/web-boundary.spec.ts` covers the rest — a sibling subdomain,
null and malformed `Origin`, stale post-logout proof, warm instance isolation —
and has only ever run against the local terminator. Running it against the
deployment with a real session completes the evidence, and that needs hosted
Auth.

## Automatic deployment

A Vercel project connected to a GitHub repository builds and deploys on push by
default, which makes merging a pull request a deployment.

**The owner accepted this on 2026-09-05: every merge to the connected branch is
an authorized Console deployment.** That is the written acceptance the release
rules require, and it applies to the Console only. It authorizes nothing in the
backend: migrations, Edge functions, and hosted Auth each still need their own
explicit authorization.

Two consequences worth stating plainly. A merge is now a release, so a change
that would be unsafe to serve must not be merged before its configuration is in
place. And a deployment that runs without the variables above fails closed
rather than serving an insecure Console, so an accidental build is a broken
deployment rather than a security incident.

## Hosted Auth follows the hostname

`supabase/auth-template-manifest.v1.json` in the backend records the expected
hosted Auth configuration, and its `siteUrl` and `additionalRedirectUrls` still
point at `https://console.evirion.test:3443`, the local host. Auth redirects
fail closed when they do not match the real origin, so the canary scenarios
cannot run until this is set to the deployed hostname.

Applying that configuration is a hosted mutation and needs its own explicit
authorization. `SEC-2026-009` stays open until the configuration is applied and
verified.

## The Console cannot be deployed first

Read from the staging project on 2026-09-05: the only Edge function deployed is
`github-webhook`, at version 4, last updated 2026-08-19. `console-api` and
`organization-invitations` are not deployed at all, and the webhook that is
deployed predates EEM-3/13 and everything after it. The database is at 29 of 52
migrations.

`CONSOLE_API_BASE_URL` therefore has nothing to point at. A Console deployed
today would be a working interface in front of an API that does not exist, and
its failures would look like Console defects rather than a missing backend.

So the Console deployment is near the end of Step 7, not the start of it.

## Order, and what is done

1. ~~Apply the 23 pending migrations to staging.~~ **Done 2026-09-05**, 29 to 52,
   forward-only, versions preserved.
2. ~~Deploy `console-api` and `organization-invitations`, redeploy
   `github-webhook`.~~ **Done 2026-09-05**, all three `ACTIVE`.
3. ~~Set the server-only variables.~~ **Done 2026-09-05.** The project was
   renamed to `evirion-console`, which incidentally restored the full
   auto-assigned domain: it had been truncated to
   `evirion-engineering-memory-dashboar.vercel.app` and is now
   `evirion-engineering-memory-dashboard.vercel.app`, which is what
   `CONSOLE_CANONICAL_ORIGIN` records. Both signing keys were generated at
   32 bytes or more and stored encrypted; neither exists in this repository.
4. ~~Deploy the Console.~~ **Done 2026-09-05.** Vercel Deployment Protection had
   to be disabled first: it answered every request with its own SSO redirect, so
   no automated check could reach the application at all.
5. Run the web boundary and accessibility suites against the deployment.
   Partially done, see above; completing it needs a session.
6. Set hosted Auth `siteUrl` and redirect URLs to the hostname, under its own
   authorization. **Not done.** `siteUrl` still points at the local host, so
   sign-in cannot succeed on staging.
7. Run the canary scenarios, which need a real session and therefore step 6.

Observed after step 4: `/` and `/auth/sign-in` answer `200`, and `/onboarding`,
`/repositories`, `/memory` and `/settings/github` each answer `307` to
`/auth/sign-in` on the canonical origin. Protected surfaces fail closed without
a session, which is the intended behaviour.
