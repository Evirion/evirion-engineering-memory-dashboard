/**
 * The loading state for the repository inventory.
 *
 * The visual treatment is open decision 5. What is not open is that the state
 * must be announced rather than implied by an empty page: a reader must be able
 * to tell "still loading" from "nothing to show".
 */
const RepositoriesLoading = () => (
  // `output` carries the status role natively, so the state is announced
  // rather than left for a reader to infer from an empty page.
  <output aria-live="polite" className="text-sm text-slate-600">
    Loading repositories.
  </output>
)

export default RepositoriesLoading
