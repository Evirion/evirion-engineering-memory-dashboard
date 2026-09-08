import { SkeletonList } from "@/components/ui/skeleton"

/**
 * One pull request and the extraction runs recorded against it.
 *
 * A skeleton rather than a spinner: this route's shape is known before its
 * data arrives, so the placeholder holds the boxes the content will occupy
 * and nothing shifts when it lands. Next renders this the moment the link is
 * clicked, which is also what gives navigation its feedback.
 */
const PullRequestLoading = () => (
  <SkeletonList label="Loading this pull request." rows={2} />
)

export default PullRequestLoading
