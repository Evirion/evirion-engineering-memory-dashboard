# Contract packet: telling the reader what happened at the Auth boundary

Six findings from walking the deployed sign-in flow on 2026-09-06. Four are
presentation and routing and introduce no state. Two change the authentication
boundary itself, which is why this packet exists before any of them is written.

Nothing here is implemented yet. This document is the thing to disagree with.

## 1. What was found

| # | Finding | Introduces state |
|---|---|---|
| A1 | Every Auth failure is a bare `303` with no reason. No route emits an outcome and no page reads one. | no |
| A2 | One wrong digit clears the pre-auth cookies, so a typo costs a fresh emailed code. | **yes** |
| A3 | `/auth/sign-in`, `/auth/verify`, `/auth/invite` and `/auth/recovery` are reachable with a live session. | no |
| A4 | `/` serves the placeholder to everyone. Its own comment says the Auth phase would replace it with a redirect. | no |
| A5 | A transient bootstrap failure keeps the session cookies and nothing ever retries. | **yes** |
| A6 | `ORGANIZATION_MEMBERSHIP_REQUIRED` renders as "not available for the selected organization" to a reader who belongs to none. | no |

### What the walk also established

`src/lib/auth/pre-auth-transaction.ts` is imported by its own test and by
nothing else. The state machine that A5's comment relies on is modelled, tested
and never executed. The backend has the matching
`private.console_pre_auth_transactions` table, but only invitation acceptance
writes a row; plain sign-in creates no server-side transaction at all, so the
two pre-auth cookies are the entire state of a sign-in.

That is the fact that shapes A2 and A5.

## 2. Why silence is not the security property

The uniform reply exists to stop account enumeration, and it must stay uniform.
But OWASP asks for *the same message for every outcome*, not for no message:
A07:2025 words it as "using the same messages for all outcomes". The current
design conflates uniform with absent, and pays for a property it already has by
other means.

One sentence, identical for a wrong code, an expired code, a failed CSRF check
and a refused admission, reveals exactly as much as the present silence and
tells the reader what to do next.

## 3. State transitions

### A2, verification attempts

Today the machine has no failure edge at all: `OTP_VERIFY_STARTED` leads only to
`OTP_VERIFIED` or `VERIFY_OUTCOME_UNKNOWN`. A wrong code falls outside it and is
handled by clearing cookies.

| From | Event | To | Cookies | Mail |
|---|---|---|---|---|
| `OTP_REQUESTED` | `VERIFY_OTP` | `OTP_VERIFY_STARTED` | unchanged | none |
| `OTP_VERIFY_STARTED` | `OTP_VERIFY_REFUSED`, attempts < limit | `OTP_REQUESTED` | attempt counter advances | none |
| `OTP_VERIFY_STARTED` | `OTP_VERIFY_REFUSED`, attempts = limit | `FAILED` | all pre-auth cleared | none |
| `OTP_VERIFY_STARTED` | `OTP_VERIFY_SUCCEEDED` | `OTP_VERIFIED` | pre-auth cleared, session written | none |
| `OTP_VERIFY_STARTED` | `OTP_VERIFY_RESPONSE_LOST` | `VERIFY_OUTCOME_UNKNOWN` | all pre-auth cleared | none |

`OTP_VERIFY_REFUSED` is a new event. It is the whole of A2.

**The counter has nowhere honest to live.** A signed cookie can be replayed: an
attacker keeps a copy of the proof carrying `attempts: 0` and presents it again
after each failure. Three candidates, none free:

1. **Attempt count inside the re-issued CSRF proof.** Cheap, and replayable
   exactly as described. Rejected unless paired with single-use proof
   generations, which is its own state.
2. **A backend pre-auth transaction for sign-in**, as invitation acceptance
   already has. Authoritative and replay-proof, because the row is the counter.
   Costs a backend route, a migration and a cross-repository change.
3. **Leave the count at one and say so.** No new state; the reader is told the
   code is single-use before they type it, and a refusal explains that a new
   code is needed. Weakest usability, strongest simplicity.

Supabase's own `rate_limit_otp` of 30 an hour already bounds guessing globally,
so the choice is about usability rather than about whether brute force is open.

**This packet does not choose.** It is the one decision that must be made before
A2 is written.

### A5, bootstrap retry

| From | Event | To | Session cookies | Backend session |
|---|---|---|---|---|
| `OTP_VERIFIED` | `BOOTSTRAP_STARTED` | `BOOTSTRAP_PENDING` | written | none yet |
| `BOOTSTRAP_PENDING` | `BOOTSTRAP_COMMITTED` | `CONSUMED` | kept | created |
| `BOOTSTRAP_PENDING` | terminal refusal | `FAILED` | **cleared** | none |
| `BOOTSTRAP_PENDING` | transient failure | `BOOTSTRAP_PENDING` | kept | none |

The last row is where the reader is now stranded: cookies say signed in, the
backend has no session, and no later request retries. Two ways out:

1. **Retry on the next protected request.** `requireSessionContext` already
   detects the condition, because the backend answers
   `AUTHENTICATION_REQUIRED` when no Console session row exists. It could
   attempt one bootstrap before giving up. Self-healing, and it puts a mutation
   on a read path, which needs saying out loud.
2. **Refuse to hold cookies without a backend session.** Treat a transient
   bootstrap failure as terminal: clear the cookies and send the reader back to
   sign-in with the A1 message. Loses the "do not consume a second code"
   property the comment protects.

Option 1 preserves the stated intent; option 2 is smaller and fails closed.
Again, this packet states the choice rather than making it.

## 4. Read and mutation matrix

| Surface | Reads | Mutates | No-side-effect invariant |
|---|---|---|---|
| `proxy` A3 guard | session cookies | nothing | A redirect decision must not write, clear or refresh any cookie. |
| `/` A4 redirect | session cookies | nothing | Same. An unauthenticated reader still gets the placeholder byte-for-byte. |
| Auth pages A1 | one outcome parameter | nothing | Rendering a message must not alter the transaction or its generation. |
| `verify-otp` A2 | pre-auth cookies | attempt state, pre-auth cookies on the terminal edge | A refusal below the limit must not touch the session cookies, the generation, or send mail. |
| `requireSessionContext` A5 option 1 | session cookies | a backend session, once | A second failure in the same request must not retry again. |
| Error mapping A6 | nothing | nothing | Wording only. No treatment changes, no new error code. |

## 5. Lock order

A1, A3, A4 and A6 take no lock and touch no row. A2 option 2 and A5 option 1
reach the backend and inherit the order already fixed there: **session, then
organization, then membership**. Neither may introduce a second order, and
neither may hold a lock across the provider call.

## 6. Trust and parity

| Boundary | Rule |
|---|---|
| Outcome parameter | An enum of stable codes, never prose, never a provider message. An unrecognised value renders the generic sentence rather than nothing. |
| Outcome and enumeration | The rendered sentence is identical for every failure. Tests assert equality across causes, not merely presence. |
| Redirect targets | Only the existing allowlist. A3 and A4 add no new target. |
| Attempt counter | Whatever holds it must be unforgeable **and** unreplayable. A signed value that can be presented twice is neither. |

## 7. Acceptance map

| Row | Test |
|---|---|
| A1 uniform sentence | A wrong code, an expired code and a failed CSRF check produce byte-identical rendered output. |
| A1 unknown value | An outcome parameter the Console does not publish renders the generic sentence. |
| A2 below limit | A refusal keeps the transaction and mails nothing. |
| A2 at limit | The next refusal clears every pre-auth cookie. |
| A2 replay | Presenting a stale proof does not lower the count. Fails today by construction under candidate 1. |
| A3 | Each of the four pages redirects a reader holding a live session and serves normally without one. |
| A4 | `/` redirects with a session and is byte-identical without one. |
| A5 | A transient bootstrap failure leaves no state that a later request cannot resolve. |
| A6 | The rendered sentence is true for a reader with no organization and for one with several. |

Every row above is currently unwritten. None of them passes today.

## 8. The two decisions, taken 2026-09-06

**A2: candidate 3.** One attempt, stated before the reader types and explained
when it fails. No new state.

**A5: fail closed.** A transient bootstrap failure clears the session cookies
and returns the reader to sign-in with the A1 sentence. No retry, no mutation on
a read path, no half-formed session.

Both were chosen for the same reason, and it is worth recording because it will
expire. The complexity in either direction existed to avoid spending an emailed
code, and that was expensive when `GOTRUE_RATE_LIMIT_EMAIL_SENT` was **2 an
hour** — the setting that returned 429 to the first sign-in attempt after the
template fix. It is now 30. A fresh code costs nothing, so paying for one with
either a replayable counter or a writing read is a bad trade.

**When that reasoning stops holding.** A real design partner mistyping codes,
or any reason to lower the limit again, brings candidate 2 back: the backend
already has `private.console_pre_auth_transactions` and only needs sign-in to
write to it. The comment in `verify-otp` that promises a retry is removed rather
than left describing behaviour that no longer exists.

All six rows are now unblocked.

---

# A7: the bootstrap proof has never been verifiable

Found on 2026-09-06 while answering "how do I clear my sign-in and start over".
The answer was "nothing needs clearing", and the reason was worse than the
question: three sign-ins had produced **zero** rows in
`core.console_auth_sessions`, including one after every other fix was deployed.

This is larger than the six above and is stated separately.

## What each side does

| | Console produces | Backend requires |
|---|---|---|
| Segments | 2: `payload.signature` | 3: `header.payload.signature` |
| Header | none | `{ alg: "EdDSA", kid, typ: "JWT" }` |
| Signature | HMAC-SHA256, shared secret | Ed25519, public JWK matched by `kid` |
| Claim names | camelCase: `idempotencyKey`, `preAuthTransactionId`, `bodyDigest`, `tokenDigest` | snake_case: `idempotency_key`, `pre_auth_id`, `request_sha256`, `token_sha256` |

These cannot interoperate under any configuration. `CONSOLE_BFF_PUBLIC_JWKS`,
`CONSOLE_BFF_PROOF_ISSUER`, `CONSOLE_BFF_PROOF_AUDIENCE` and
`CONSOLE_PRE_AUTH_HMAC_KEY` are also unset on the deployed Edge Function, but
setting them would change nothing: an HMAC blob has no `kid` to match.

## Why it survived every gate

`tools/console-stub` does not implement `/internal/console/v1/session/bootstrap`
at all. The call 404s, the adapter classifies that as `unsupported`, and the
route treated `unsupported` as transient and kept the cookies. Every Console
test therefore signed in "successfully" while the bootstrap failed, in a double
that could not have succeeded.

A5 makes this visible rather than fixing it: once a failed bootstrap is
terminal, sign-in stops working outright instead of half-working. **PR #32 is
held until this is closed.**

## Direction, decided 2026-09-06

The Console moves to EdDSA. Asymmetric signing means the backend holds only a
public key, so no shared secret has to exist in two deployments at once.

## Claim contract

Exactly fifteen keys, no more and no fewer, since the backend uses an exact-key
check:

`aud`, `exp`, `iat`, `idempotency_key`, `invitation_id`, `iss`, `method`,
`nonce`, `path`, `pre_auth_id`, `request_sha256`, `session_id`, `sub`,
`token_sha256`.

| Claim | Value |
|---|---|
| `iss` / `aud` | `console-bff` / `evirion-console-bootstrap` unless the Edge Function overrides them |
| `nonce` | a UUID; the backend rejects any other shape |
| `token_sha256` | `sha256(accessToken)` |
| `request_sha256` | canonical hash of the body, see below |
| `invitation_id` | `null` for sign-in, a UUID for invitation acceptance |
| `exp - iat` | at most 120 seconds; both sides already agree |

## Parity row that is currently true by luck

The backend hashes `JSON.stringify(canonicalValue(body))`, sorting object keys
recursively. The Console hashes the caller's `JSON.stringify(body)` in insertion
order.

Both current bodies carry **one key** — `{ preAuthTransactionId }` and
`{ invitationId }` — so sorted and unsorted are identical and the digests agree.
The first two-key body would break sign-in with no other change, and no test
would say why. The Console must canonicalise, and a test must use a body whose
insertion order differs from its sorted order.

## Acceptance map

| Row | Test |
|---|---|
| Shape | The proof parses as three segments with an `EdDSA` header carrying a `kid`. |
| Keys | The payload has exactly the fifteen keys, asserted as a set. |
| Signature | The backend verifier accepts a Console-produced proof against the published JWKS. |
| Canonical parity | A two-key body whose insertion order differs from sorted order produces the digest the backend computes. |
| Nonce | A non-UUID nonce is refused. |
| Lifetime | A proof older than 120 seconds is refused. |
| Stub | The double implements the route and refuses a proof it cannot verify, so a Console test can no longer pass on a 404. |

## Deployment consequence

A private key reaches Vercel and a public JWKS reaches the Supabase Edge
Function. Neither is a code change and both need separate authorization.
