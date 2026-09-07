import { describe, expect, it } from "vitest"

import { heartbeatIsDue, idleStateAt, minutesRemaining } from "@/lib/auth/idle-window"
import { SESSION_POLICY } from "@/lib/auth/session-policy"

const { idleExpirySeconds, idleWarningSeconds, touchCoalescingSeconds } = SESSION_POLICY

describe("the idle window a reader is shown", () => {
  it("says nothing while the reader is well inside the window", () => {
    expect(idleStateAt(0)).toBe("active")
    expect(idleStateAt(idleExpirySeconds - idleWarningSeconds - 1)).toBe("active")
  })

  it("warns exactly one warning period before the window closes", () => {
    expect(idleStateAt(idleExpirySeconds - idleWarningSeconds)).toBe("warning")
    expect(idleStateAt(idleExpirySeconds - 1)).toBe("warning")
  })

  it("reports the window as elapsed once it closes", () => {
    expect(idleStateAt(idleExpirySeconds)).toBe("elapsed")
    expect(idleStateAt(idleExpirySeconds * 2)).toBe("elapsed")
  })

  it("counts down in whole minutes and never promises zero", () => {
    expect(minutesRemaining(idleExpirySeconds - 300)).toBe(5)
    expect(minutesRemaining(idleExpirySeconds - 61)).toBe(2)
    expect(minutesRemaining(idleExpirySeconds - 1)).toBe(1)
    // Past the deadline the caller renders the elapsed notice, but the figure
    // must still be sane rather than negative.
    expect(minutesRemaining(idleExpirySeconds + 600)).toBe(1)
  })

  it("sends a heartbeat no faster than the database will accept one", () => {
    expect(heartbeatIsDue(0)).toBe(false)
    expect(heartbeatIsDue(touchCoalescingSeconds - 1)).toBe(false)
    expect(heartbeatIsDue(touchCoalescingSeconds)).toBe(true)
  })

  it("reads the window from the frozen policy rather than a local constant", () => {
    const shortened = {
      idleExpirySeconds: 600,
      idleWarningSeconds: 120,
    }

    expect(idleStateAt(479, shortened)).toBe("active")
    expect(idleStateAt(480, shortened)).toBe("warning")
    expect(idleStateAt(600, shortened)).toBe("elapsed")
  })
})
