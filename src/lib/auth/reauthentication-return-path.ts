import { resolveSafeRedirect } from "@/lib/security/request-origin"

/**
 * Keep customer filters on the return path while stripping ceremony markers.
 *
 * Only the path segment is safety-checked; query keys other than `reauth` and
 * `result` are preserved so selections such as `supersedeWith` survive step-up.
 */
export const normalizeReturnPath = (candidate: string): string => {
  const trimmed = candidate.trim()
  if (trimmed === "") return "/"

  const queryIndex = trimmed.indexOf("?")
  const pathPart = queryIndex === -1 ? trimmed : trimmed.slice(0, queryIndex)
  const safePath = resolveSafeRedirect(pathPart)
  if (safePath === "/") return safePath

  if (queryIndex === -1) return safePath

  const params = new URLSearchParams(trimmed.slice(queryIndex + 1))
  params.delete("reauth")
  params.delete("result")
  const query = params.toString()
  return query === "" ? safePath : `${safePath}?${query}`
}
