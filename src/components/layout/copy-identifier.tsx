"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"

/**
 * Copies an identifier the interface can only show in full by being asked.
 *
 * The Console has no display name for an organization — the contract
 * publishes the identifier and nothing else — so a UUID is the only thing the
 * header can state, and a UUID is both too long for the space and exactly the
 * kind of string someone needs to paste into a support message. Truncating it
 * without offering a copy would leave them retyping from a tooltip.
 *
 * Confirmation is a swapped glyph plus a live region, held for a moment and
 * then dropped. A control that says "Copied" for ever stops reporting the
 * next press.
 */
const CONFIRMATION_MS = 2000

export const CopyIdentifier = ({
  value,
  label,
}: {
  value: string
  /** Names the thing being copied, since the glyph cannot. */
  label: string
}) => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // A press just before unmount would otherwise set state on a gone component.
  useEffect(() => () => clearTimeout(timer.current), [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Clipboard access can be refused by permission or an insecure context.
      // Saying nothing is right: the value is on screen and selectable, so the
      // reader has a way through that does not depend on this button.
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), CONFIRMATION_MS)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        className="text-muted-foreground hover:text-foreground hover:bg-muted tactile hit-area inline-flex size-6 shrink-0 items-center justify-center rounded-md"
      >
        {copied ? (
          <Check aria-hidden className="size-3.5" strokeWidth={2} />
        ) : (
          <Copy aria-hidden className="size-3.5" strokeWidth={1.5} />
        )}
      </button>
      <output aria-live="polite" className="sr-only">
        {copied ? `${label} copied` : ""}
      </output>
    </>
  )
}
