import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 lg:ml-64 min-h-screen print:ml-0 print:h-auto print:bg-white">
            <div className="p-4 lg:p-6 w-full print:max-w-none print:p-0">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
