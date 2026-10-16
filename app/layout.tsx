import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/AppShell'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '旅行管理システム',
  description: '障害福祉施設 一泊旅行管理システム',
}

// スマホ・タブレットで入力欄のフォーカス時やドラッグ操作時に勝手に拡大されないようにする
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={`${geist.className} bg-gray-50 min-h-screen`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
