import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Maddiq',
  description: 'AI-native CRM and accounting platform for UK accounting firms',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-brand-light">
        {children}
      </body>
    </html>
  )
}
