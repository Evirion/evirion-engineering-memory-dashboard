import { SkeletonMetrics } from "@/components/ui/skeleton"

/**
 * GitHub installation counters and the connection panel.
 *
 * A skeleton rather than a spinner: this route's shape is known before its
 * data arrives, so the placeholder holds the boxes the content will occupy
 * and nothing shifts when it lands. Next renders this the moment the link is
 * clicked, which is also what gives navigation its feedback.
 */
const GithubSettingsLoading = () => (
  <SkeletonMetrics label="Loading GitHub settings." cells={4} />
)

export default GithubSettingsLoading
