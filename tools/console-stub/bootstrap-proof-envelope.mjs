/**
 * The envelope checks the Edge function applies to a bootstrap proof.
 *
 * Extracted so a test can feed it a proof this repository actually produced.
 * The double answered a 404 for this route until 2026-09-06, the adapter read
 * that as a transient failure, and every Console test signed in "successfully"
 * while the proof format was one the backend could never accept. A double that
 * checks nothing is the same hazard in a quieter form, and one nothing exercises
 * is the same hazard again.
 *
 * The signature is not verified here: that needs the deployment's public JWK,
 * which the double does not hold. Everything that does not need the key is
 * checked, which is every way the two formats differed.
 */

const PAYLOAD_KEYS = [
  "aud",
  "exp",
  "iat",
  "idempotency_key",
  "invitation_id",
  "iss",
  "method",
  "nonce",
  "path",
  "pre_auth_id",
  "request_sha256",
  "session_id",
  "sub",
  "token_sha256",
]
  .toSorted()
  .join(",")

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The backend refuses anything longer. */
const MAX_LIFETIME_SECONDS = 120

const refused = (reason) => ({ ok: false, reason })

export const describeBootstrapProofEnvelope = (proof) => {
  if (typeof proof !== "string") return refused("missing")

  const segments = proof.split(".")
  if (segments.length !== 3) return refused("not-a-jwt")

  let header
  let payload
  try {
    header = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8"))
    payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"))
  } catch {
    return refused("undecodable")
  }

  if (
    Object.keys(header).toSorted().join(",") !== "alg,kid,typ" ||
    header.alg !== "EdDSA" ||
    header.typ !== "JWT" ||
    typeof header.kid !== "string" ||
    header.kid.length < 1 ||
    header.kid.length > 128
  ) {
    return refused("header")
  }

  if (Object.keys(payload).toSorted().join(",") !== PAYLOAD_KEYS) {
    return refused("payload-keys")
  }

  if (!UUID.test(String(payload.nonce))) return refused("nonce")

  if (
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > MAX_LIFETIME_SECONDS
  ) {
    return refused("lifetime")
  }

  return { ok: true }
}
