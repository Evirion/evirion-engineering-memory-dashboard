import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * Root entry. A reader holding a session never reaches this body: the proxy
 * sends them to their landing first. So everyone who does arrive here needs a
 * session, and the only honest answer is the door.
 *
 * This replaces the placeholder that ADR-0003 declared and the Auth phase was
 * meant to retire. It outlived that phase, and the first partner sent to the
 * Console landed on it and found nothing.
 */
const HomePage = () => {
  redirect("/auth/sign-in")
}

export default HomePage
