'use client'
// 終了したイベント（閲覧専用）を選んでいるあいだ、画面からの書き込み（POST・PUT・DELETE など）を送る前に止める
// サーバー側でも proxy.ts が同じ基準で拒否するが、画面上で「動かしたのに保存されない」状態を作らないため、
// 止めたときはお知らせを出して画面を読み込み直し、保存済みの状態に戻す
import { useEffect } from 'react'
import { isReadOnlyAllowedApi } from '@/lib/event-shared'
import { useCurrentEvent } from '@/lib/useCurrentEvent'

export default function ReadOnlyGuard() {
  const { event, readOnly } = useCurrentEvent()

  useEffect(() => {
    if (!readOnly || !event) return
    const original = window.fetch
    window.fetch = (input, init) => {
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
      const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method)
      if (isWrite && url.origin === window.location.origin && url.pathname.startsWith('/api/') && !isReadOnlyAllowedApi(url.pathname)) {
        alert(`「${event.name}」は終了したイベントのため閲覧専用です。変更は保存されません。\n画面を元の状態に戻します。`)
        window.location.reload()
        return Promise.resolve(
          new Response(JSON.stringify({ error: '閲覧専用のイベントです' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
        )
      }
      return original(input, init)
    }
    return () => {
      window.fetch = original
    }
  }, [readOnly, event])

  return null
}
