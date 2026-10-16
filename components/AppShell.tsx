'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import { PRINT_PATH } from '@/lib/menu'

// 印刷専用ページ（/print）はサイドバーなし・余白なしの全幅で表示する
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  if (pathname === PRINT_PATH) {
    return <main className="min-h-screen bg-gray-100 print:bg-white">{children}</main>
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 lg:ml-64 min-h-screen print:ml-0 print:h-auto print:bg-white">
        <div className="p-4 lg:p-6 w-full print:max-w-none print:p-0">
          {children}
        </div>
      </main>
    </div>
  )
}
