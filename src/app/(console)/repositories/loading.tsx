import { SkeletonList } from "@/components/ui/skeleton"

/**
 * The loading state for the repository inventory.
 *
 * A skeleton rather than a spinner: the shape of this list is known before
 * the data arrives, so the placeholder holds the boxes the rows will occupy
 * and nothing shifts when they land. A spinner would only report that
 * something is happening, which the reader already knows.
 *
 * The state is still announced rather than implied by an empty page. The
 * shimmer is for the eye; the polite live region inside `SkeletonList` is
 * what tells a screen reader the same thing.
 */
const RepositoriesLoading = () => (
  <SkeletonList label="Loading repositories." rows={4} />
)

export default RepositoriesLoading
