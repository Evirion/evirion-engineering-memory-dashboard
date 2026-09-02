import { readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const repositoryRoot = new URL("../../", import.meta.url)

const SOURCE_SUFFIXES = [".ts", ".tsx", ".mts", ".mjs"]

/** List repository-relative source paths under `directory`, sorted. */
export const collectSourceFiles = (directory: string): string[] => {
  const absolute = fileURLToPath(new URL(directory, repositoryRoot))
  const found: string[] = []

  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current).toSorted()) {
      const child = `${current}/${entry}`
      const relative = `${prefix}/${entry}`
      if (statSync(child).isDirectory()) {
        walk(child, relative)
        continue
      }
      if (SOURCE_SUFFIXES.some((suffix) => entry.endsWith(suffix))) {
        found.push(relative)
      }
    }
  }

  walk(absolute, directory)
  return found
}
