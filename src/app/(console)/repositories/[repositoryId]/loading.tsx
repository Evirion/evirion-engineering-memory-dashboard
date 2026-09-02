/**
 * The loading state for one repository. The visual treatment is open decision
 * 5; announcing the state rather than implying it with a blank page is not.
 */
const RepositoryDetailLoading = () => (
  <output aria-live="polite" className="text-sm text-slate-600">
    Loading this repository.
  </output>
)

export default RepositoryDetailLoading
