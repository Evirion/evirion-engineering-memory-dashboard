import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"

import "./globals.css"

// Alpha renders no cacheable authenticated document. Keeping the root dynamic
// stops a tenant response from reaching the Next.js data, router or CDN cache.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Evirion Engineering Memory Console",
  description: "Design Partner Console",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

/**
 * Geist ships its own woff2 files and `next/font/local` serves them from this
 * origin, so the typeface needs no build-time fetch from Google and satisfies
 * the `font-src 'self'` the Console's Content-Security-Policy enforces.
 *
 * The canvas wash rides on the body as a background image rather than a fixed
 * layer behind it. A `-z-10` sibling would paint underneath the body's own
 * background colour and never be seen, and `bg-fixed` anchors the gradient to
 * the viewport so scrolling does not repaint it.
 */
const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
    <body className="bg-background bg-canvas-wash text-foreground min-h-dvh bg-fixed font-sans antialiased">
      {children}
    </body>
  </html>
)

export default RootLayout
