'use client'
// 選択中のイベントで OFF になっている機能のページを開いたとき、中身の代わりに案内を出す
// （メニューには出ないが、ブックマークや URL の直接入力で開いた場合のため）
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { moduleLabel, moduleOfPath } from '@/lib/modules'
import { useCurrentEvent, useModules } from '@/lib/useCurrentEvent'

export default function ModuleGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { event } = useCurrentEvent()
  const { pathEnabled } = useModules()

  if (pathEnabled(pathname)) return <>{children}</>

  const key = moduleOfPath(pathname) ?? ''
  const isAdmin = pathname.startsWith('/admin')
  return (
    <div className="max-w-xl mx-auto pt-16 lg:pt-8">
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm space-y-3">
        <h1 className="text-xl font-bold text-gray-800">この機能は使っていません</h1>
        <p className="text-sm text-gray-600">
          「{moduleLabel(key)}」は、選んでいるイベント「{event?.name}」では OFF になっています。
        </p>
        <p className="text-sm text-gray-600">
          使うときは、管理画面の「🗂️ イベント管理」で、このイベントの機能を ON にしてください。
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={isAdmin ? '/admin' : '/'} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            ダッシュボードへ
          </Link>
          {isAdmin && (
            <Link href="/admin/events" className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
              🗂️ イベント管理
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
