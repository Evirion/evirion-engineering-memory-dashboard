import { SkeletonTable } from "@/components/ui/skeleton"

/**
 * The membership inventory, invitations and offboarding status.
 *
 * A skeleton rather than a spinner: this route's shape is known before its
 * data arrives, so the placeholder holds the boxes the content will occupy
 * and nothing shifts when it lands. Next renders this the moment the link is
 * clicked, which is also what gives navigation its feedback.
 */
const MembersLoading = () => (
  <SkeletonTable label="Loading members." rows={4} columns={4} />
)

export default MembersLoading
