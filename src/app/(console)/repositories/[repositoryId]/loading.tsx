import { SkeletonList } from "@/components/ui/skeleton"

/**
 * The loading state for one repository. A skeleton holds the layout so
 * nothing shifts on arrival; the polite live region inside it is what
 * announces the state rather than leaving a blank page to imply it.
 */
const RepositoryDetailLoading = () => (
  <SkeletonList label="Loading this repository." rows={3} />
)

export default RepositoryDetailLoading
