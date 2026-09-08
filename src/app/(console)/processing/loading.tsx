import { SkeletonTable } from "@/components/ui/skeleton"

/**
 * Processing activity, which is the one true table in the Console.
 *
 * A skeleton rather than a spinner: this route's shape is known before its
 * data arrives, so the placeholder holds the boxes the content will occupy
 * and nothing shifts when it lands. Next renders this the moment the link is
 * clicked, which is also what gives navigation its feedback.
 */
const ProcessingLoading = () => (
  <SkeletonTable label="Loading processing activity." rows={6} columns={6} />
)

export default ProcessingLoading
