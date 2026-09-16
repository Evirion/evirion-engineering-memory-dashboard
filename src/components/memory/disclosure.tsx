import type { ReactNode } from "react"

/**
 * Native disclosure used on the Knowledge Object page.
 *
 * The summary stays a one-line choice. A hint on the summary is visible while
 * the panel is closed, which is how a collapsed lifecycle action still states
 * that submitting may ask for an authenticator code. `open` is presentation
 * only: it never hides a refusal, a conflict, or an unsupported state.
 */
const frame =
  "group rounded-2xl border border-border bg-card px-5 py-3 shadow-panel"
const summaryClass =
  "text-foreground cursor-pointer text-sm font-semibold"

export const MemoryDisclosure = ({
  summary,
  children,
  hint,
  open,
  testId,
}: {
  readonly summary: string
  readonly children: ReactNode
  readonly hint?: string
  readonly open?: boolean
  readonly testId?: string
}) => (
  <details open={open || undefined} data-testid={testId} className={frame}>
    <summary className={summaryClass}>
      <span className="underline underline-offset-2">{summary}</span>
      {hint === undefined ? null : (
        <span className="mt-1 block text-xs font-normal text-ink-secondary">
          {hint}
        </span>
      )}
    </summary>
    <div className="mt-3">{children}</div>
  </details>
)
