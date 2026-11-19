'use client'
// サイドバー上部: いま選んでいるイベントの名前・日程と、イベントの切り替え
import { useState } from 'react'
import { formatEventPeriod } from '@/lib/event-shared'
import { switchEvent, useEvents } from '@/lib/useCurrentEvent'

export default function EventSwitcher({ tone = 'blue' }: { tone?: 'blue' | 'slate' }) {
  const { events, current, loaded } = useEvents()
  const [busy, setBusy] = useState(false)
  const sub = tone === 'blue' ? 'text-blue-300' : 'text-slate-400'
  const selectCls =
    tone === 'blue'
      ? 'bg-blue-800 border-blue-500 text-white'
      : 'bg-slate-800 border-slate-600 text-white'

  if (!loaded) return <p className={`${sub} text-xs mt-1`}>読み込み中…</p>
  if (!current) return <p className={`${sub} text-xs mt-1`}>イベント未登録</p>

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBusy(true)
    try {
      await switchEvent(Number(e.target.value))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'イベントの切り替えに失敗しました')
      setBusy(false)
    }
  }

  return (
    <div className="mt-1">
      {events.length > 1 ? (
        <select
          value={current.id}
          onChange={onChange}
          disabled={busy}
          aria-label="イベントを切り替え"
          className={`w-full mt-1 rounded-md border px-2 py-1 text-xs ${selectCls}`}
        >
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.status === 'CLOSED' ? '🔒 ' : ''}
              {ev.name}（{formatEventPeriod(ev)}）
            </option>
          ))}
        </select>
      ) : (
        <>
          <p className={`${sub} text-xs`}>{current.name}</p>
          <p className={`${sub} text-xs`}>{formatEventPeriod(current)}</p>
        </>
      )}
      {current.status === 'CLOSED' && (
        <p className="mt-1 inline-block rounded bg-amber-400/90 px-2 py-0.5 text-[11px] font-bold text-amber-950">
          🔒 終了（閲覧専用）
        </p>
      )}
    </div>
  )
}
