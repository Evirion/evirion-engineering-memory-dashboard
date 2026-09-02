import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

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

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body className="min-h-dvh bg-white font-sans text-slate-900 antialiased">
      {children}
    </body>
  </html>
)

export default RootLayout
