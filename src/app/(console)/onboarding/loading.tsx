import { SkeletonList } from "@/components/ui/skeleton"

/**
 * The first-run welcome and GitHub connection step.
 *
 * A skeleton rather than a spinner: this route's shape is known before its
 * data arrives, so the placeholder holds the boxes the content will occupy
 * and nothing shifts when it lands. Next renders this the moment the link is
 * clicked, which is also what gives navigation its feedback.
 */
const OnboardingLoading = () => <SkeletonList label="Loading onboarding." rows={2} />

export default OnboardingLoading
