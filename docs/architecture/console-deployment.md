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

Treat the above as a requirement to verify, not a fact already verified.
`tests/security/web-boundary.spec.ts` already covers forged forwarding headers,
a sibling subdomain, null and malformed `Origin`, and stale post-logout proof.
It has only ever run against the local terminator. Running it against the
deployment is what turns this section from an argument into evidence.

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

## Order

1. Apply the 23 pending migrations to staging. Backend, forward-only, its own
   authorization.
2. Deploy `console-api` and `organization-invitations`, and redeploy
   `github-webhook` at the current revision. Backend, its own authorization.
3. Decide the Console hostname and set the server-only variables, generating
   both signing keys. `CONSOLE_API_BASE_URL` is real only after step 2.
4. Deploy the Console, which now happens by merging.
5. Run the web boundary and accessibility suites against the deployment. This is
   what turns the trusted-edge argument above into evidence.
6. Set hosted Auth `siteUrl` and redirect URLs to the hostname, under its own
   authorization.
7. Run the canary scenarios, which need a real session and therefore step 6.

Steps 1 and 2 are independent of the Console and can be authorized on their own.
Nothing from step 3 onward is reachable before them.
