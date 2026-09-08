/**
 * The seven tones every Console status resolves to.
 *
 * The load-bearing split is `progress` against `holding`. Both mean "not
 * you", and conflating them is what leaves a customer watching a spinner for
 * an authorization no spinner will ever deliver:
 *
 * - `progress` finishes on its own. Wait.
 * - `holding` will not finish on its own, and you are offered no control,
 *   because the decision belongs to Evirion.
 *
 * `attention` is the only tone permitted to carry a control, which is what
 * makes "is there something for me to do here" answerable by colour alone
 * before a word is read.
 *
 * `unknown` is never success and never failure. A server state this Console
 * does not recognise fails closed into it rather than being guessed at.
 */
export type Tone =
  "verified" | "attention" | "rejected" | "progress" | "holding" | "neutral" | "unknown"
