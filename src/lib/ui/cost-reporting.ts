/**
 * Whether the Console shows a customer what work costs.
 *
 * Suspended on 2026-09-08 by product decision. It is a suspension rather than
 * a removal, and the distinction is load-bearing: requirement G-006 in
 * `docs/product/design-partner-console-requirements.md` still reads that an
 * Admin sees cost through safe projections, and it was not amended, so the
 * Console is knowingly short of an accepted requirement for as long as this
 * stays `false`. `docs/CHANGELOG.md` carries the record of that gap and who
 * owns closing it either way.
 *
 * One constant rather than one per surface, so the two places that report
 * cost — the processing table and the usage panel — cannot drift into a state
 * where a customer sees a figure on one page and not the other. Everything
 * behind it stays wired and typechecked, so restoring is this word.
 *
 * This governs *reporting* only. The budget fields on the import approval and
 * the repository consent are how a customer authorizes spend with a ceiling,
 * not a disclosure of what was spent, and they are deliberately not gated
 * here: taking them out would remove the paid-authorization path.
 */
export const SHOW_COST_FIGURES = false
