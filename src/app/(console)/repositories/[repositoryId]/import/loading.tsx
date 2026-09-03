/**
 * The loading state for one historical import. The visual treatment is open
 * decision 5; announcing the state rather than implying it with a blank page
 * is not.
 */
const RepositoryImportLoading = () => (
  <output aria-live="polite" className="text-sm text-slate-600">
    Loading this import.
  </output>
)

export default RepositoryImportLoading
