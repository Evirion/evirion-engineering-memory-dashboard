import { describe, expect, it, vi } from "vitest"

/**
 * The root must send a reader somewhere they can act.
 *
 * ADR-0003 declared the route with a placeholder body and said the Auth phase
 * would replace it with a redirect. The phase shipped and the placeholder
 * stayed, so the first design partner pointed at the Console read that the
 * deployment carried no functionality and stopped there.
 *
 * A reader holding a session never reaches this body — the proxy sends them to
 * their landing first — so the redirect is unconditional by construction.
 */

const redirect = vi.fn()

vi.mock("next/navigation", () => ({ redirect }))

const HomePage = (await import("@/app/page")).default

describe("the Console root", () => {
  it("sends a reader without a session to sign-in", () => {
    HomePage()

    expect(redirect).toHaveBeenCalledWith("/auth/sign-in")
  })

  it("renders no body of its own", () => {
    redirect.mockReturnValue(undefined)

    expect(HomePage()).toBeUndefined()
  })
})
