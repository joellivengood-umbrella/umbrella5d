import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Umbrella5D',
    template: '%s — Umbrella5D',
  },
  description:
    'The business education platform built on the Five Dimensions framework. Revenue. Profits. Glory.',
  // Favicon is set by the App Router file convention: src/app/icon.png
  // (Next emits the <link rel="icon"> automatically). No metadata.icons
  // needed, and no app/favicon.ico — that .ico would override this.
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
