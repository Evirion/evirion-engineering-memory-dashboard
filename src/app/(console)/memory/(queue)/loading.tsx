import { SkeletonList } from "@/components/ui/skeleton"

/**
 * The Engineering Memory review queue.
 *
 * A skeleton rather than a spinner: this route's shape is known before its
 * data arrives, so the placeholder holds the boxes the content will occupy
 * and nothing shifts when it lands. Next renders this the moment the link is
 * clicked, which is also what gives navigation its feedback.
 *
 * The `(queue)` group is why this file is one directory deeper than the URL
 * suggests. A `loading.tsx` opens a Suspense boundary over its whole subtree,
 * so sitting directly under `memory/` it would also wrap
 * `/memory/:knowledgeObjectId` — and a boundary there flushes the shell with
 * a 200 before that page can answer `notFound()`, which turns a refused
 * object into one that appears to exist. The group scopes the boundary to
 * this route and leaves the detail page's status alone. Route groups do not
 * appear in the URL, so the frozen route contract is unchanged.
 */
const MemoryLoading = () => <SkeletonList label="Loading the review queue." rows={4} />

export default MemoryLoading
