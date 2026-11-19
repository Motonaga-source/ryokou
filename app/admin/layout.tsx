'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { MENU_ORDER_ADMIN_ITEM, ROLL_CALL_ADMIN_ITEM } from '@/lib/menu'
import { useMenuItems } from '@/lib/useMenuOrder'
import { useCurrentEvent } from '@/lib/useCurrentEvent'
import EventSwitcher from '@/components/EventSwitcher'


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const { event, readOnly } = useCurrentEvent()
  // 並び替え可能なメニュー + 末尾に「点呼チェック」「メニュー並び替え」を固定
  const navItems = [
    ...useMenuItems().map(m => ({ href: m.adminPath, label: m.adminLabel, icon: m.adminIcon ?? m.icon })),
    ROLL_CALL_ADMIN_ITEM,
    MENU_ORDER_ADMIN_ITEM,
  ]

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <button
        className="fixed top-4 left-4 z-50 lg:hidden print:hidden bg-slate-800 text-white p-2 rounded-lg shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`
          print:hidden
          fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-slate-800 to-slate-950
          text-white z-40 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          flex flex-col shadow-xl
        `}
      >
        <div className="px-6 py-6 border-b border-slate-700">
          <div className="text-2xl mb-1">🔐</div>
          <h1 className="text-lg font-bold leading-tight">管理画面</h1>
          <EventSwitcher tone="slate" />
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                      transition-all duration-200
                      ${isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }
                    `}
                  >
                    <span className="text-lg">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-4 py-4 border-t border-slate-700 space-y-2">
          <Link
            href={pathname.replace('/admin', '') || '/'}
            className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors text-white print:hidden"
          >
            <span>👁️</span> プレビュー（一般画面へ）
          </Link>
          <button 
            onClick={() => window.print()} 
            className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors text-white"
          >
            <span>🖨️</span> 画面を印刷
          </button>
          <a
            href="/api/export/excel"
            className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors text-white"
          >
            <span>📊</span> Excel出力
          </a>
        </div>

        <div className="px-6 py-4 border-t border-slate-700 space-y-3 print:hidden">
          <button
            onClick={handleLogout}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            ログアウト
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-screen print:ml-0 print:bg-white print:h-auto">
        <div className="w-full mx-auto print:max-w-none print:p-0">
          {readOnly && event && (
            <div className="sticky top-0 z-30 print:hidden border-b border-amber-300 bg-amber-50 px-4 py-2 pl-16 lg:pl-4 text-sm text-amber-900">
              🔒 「{event.name}」は終了したイベントのため<strong>閲覧専用</strong>です。変更しても保存されません。
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
