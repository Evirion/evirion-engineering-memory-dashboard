import { SkeletonList } from "@/components/ui/skeleton"

/**
 * The principal's own session inventory.
 *
 * A skeleton rather than a spinner: this route's shape is known before its
 * data arrives, so the placeholder holds the boxes the content will occupy
 * and nothing shifts when it lands. Next renders this the moment the link is
 * clicked, which is also what gives navigation its feedback.
 */
const SessionsLoading = () => <SkeletonList label="Loading your sessions." rows={2} />

export default SessionsLoading
