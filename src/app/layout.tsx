import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Umbrella5D',
    template: '%s — Umbrella5D',
  },
  description:
    'The business education platform built on the Five Dimensions framework. Revenue. Profits. Glory.',
  icons: {
    icon: '/logo/Umbrella_icon.png',
  },
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
