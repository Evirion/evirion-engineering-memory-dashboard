import { SkeletonMetrics } from "@/components/ui/skeleton"

/**
 * Operational usage and the Alpha metrics, both hairline grids.
 *
 * A skeleton rather than a spinner: this route's shape is known before its
 * data arrives, so the placeholder holds the boxes the content will occupy
 * and nothing shifts when it lands. Next renders this the moment the link is
 * clicked, which is also what gives navigation its feedback.
 */
const UsageLoading = () => (
  <SkeletonMetrics label="Loading usage and metrics." cells={6} />
)

export default UsageLoading
