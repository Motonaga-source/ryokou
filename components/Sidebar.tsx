'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: '🏠' },
  { href: '/persons', label: '参加者名簿', icon: '👥' },
  { href: '/rooms', label: '部屋割り管理', icon: '🏨' },
  { href: '/bus', label: 'バス座席表', icon: '🚌' },
  { href: '/vitals', label: 'バイタルチェック', icon: '💊' },
  { href: '/medications', label: '服薬情報管理', icon: '💉' },
  { href: '/teams', label: 'チーム・配置', icon: '📋' },
  { href: '/schedule', label: 'スケジュール', icon: '🗓️' },
  { href: '/pocket-money', label: '小遣い精算', icon: '💴' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* モバイルメニューボタン */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-blue-600 text-white p-2 rounded-lg shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="メニュー"
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* オーバーレイ（モバイル） */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* サイドバー本体 */}
      <aside
        className={`
          print:hidden
          fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-blue-700 to-blue-900
          text-white z-40 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          flex flex-col shadow-xl
        `}
      >
        {/* ロゴ・タイトル */}
        <div className="px-6 py-6 border-b border-blue-600">
          <div className="text-2xl mb-1">✈️</div>
          <h1 className="text-lg font-bold leading-tight">旅行管理システム</h1>
          <p className="text-blue-300 text-xs mt-1">滋賀１泊旅行</p>
          <p className="text-blue-300 text-xs">10/23 〜 10/24</p>
        </div>

        {/* ナビゲーション */}
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
                        ? 'bg-white text-blue-800 shadow-md'
                        : 'text-blue-100 hover:bg-blue-600 hover:text-white'
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

        {/* 出力・印刷アクション */}
        <div className="px-4 py-4 border-t border-blue-600 space-y-2">
          <Link
            href={`/admin${pathname === '/' ? '' : pathname}`}
            className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors text-white print:hidden"
          >
            <span>⚙️</span> 管理画面へ（編集）
          </Link>
          <button 
            onClick={() => window.print()} 
            className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors text-white"
          >
            <span>🖨️</span> 画面を印刷
          </button>
          <a
            href="/api/export/excel?tripId=1"
            className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors text-white"
          >
            <span>📊</span> Excel出力
          </a>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-blue-600 text-blue-300 text-xs">
          <p>障害福祉施設向け</p>
          <p>旅行管理システム v1.0</p>
        </div>
      </aside>
    </>
  )
}
