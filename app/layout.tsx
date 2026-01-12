import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'devextreme/dist/css/dx.light.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mega Tower - Billing System',
  description: 'Condominium Billing Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
