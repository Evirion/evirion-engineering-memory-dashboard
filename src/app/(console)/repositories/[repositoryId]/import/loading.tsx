import { SkeletonList } from "@/components/ui/skeleton"

/**
 * The loading state for one historical import. A skeleton holds the layout so
 * nothing shifts on arrival; the polite live region inside it is what
 * announces the state rather than leaving a blank page to imply it.
 */
const RepositoryImportLoading = () => (
  <SkeletonList label="Loading this import." rows={3} />
)

export default RepositoryImportLoading
