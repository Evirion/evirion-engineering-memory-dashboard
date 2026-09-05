"use client"

import type { FormEvent, ReactNode } from "react"

import { isReauthenticationFresh } from "@/lib/auth/reauthentication-freshness"

/**
 * Intercepts a gated submit when the freshness window has closed.
 *
 * The instant is re-read on each submit rather than cached as a boolean, because
 * the window closes while the page is open.
 */
export const GatedForm = ({
  action,
  method = "post",
  freshUntil,
  gate,
  returnPath,
  mutationPath,
  className,
  dataTestId,
  ariaLabel,
  children,
}: {
  action: string
  method?: "post" | "get"
  freshUntil: string | null | undefined
  gate: "repository_import" | "knowledge_lifecycle" | "membership_change"
  returnPath: string
  mutationPath: string
  className?: string
  dataTestId?: string
  ariaLabel?: string
  children: ReactNode
}) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (method !== "post") return
    if (isReauthenticationFresh(freshUntil)) return

    event.preventDefault()

    const form = event.currentTarget
    const begin = document.createElement("form")
    begin.method = "post"
    begin.action = "/api/session/reauthentication/begin"
    begin.style.display = "none"

    const append = (name: string, value: string) => {
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = name
      input.value = value
      begin.appendChild(input)
    }

    const source = new FormData(form)
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    if (
      submitter instanceof HTMLButtonElement ||
      submitter instanceof HTMLInputElement
    ) {
      if (submitter.name !== "") {
        source.set(submitter.name, submitter.value)
      }
    }

    for (const [name, value] of source.entries()) {
      if (typeof value === "string") append(name, value)
    }
    append("gate", gate)
    append("returnPath", returnPath)
    append("mutationPath", mutationPath)

    document.body.appendChild(begin)
    begin.submit()
  }

  return (
    <form
      action={action}
      method={method}
      className={className}
      data-testid={dataTestId}
      aria-label={ariaLabel}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  )
}
