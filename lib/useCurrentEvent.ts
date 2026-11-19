'use client'
// ブラウザ側で「いま選んでいるイベント」を使うためのフック
// 1ページ内で何度呼んでも /api/events の取得は1回だけ
import { useEffect, useState } from 'react'
import { dayLabel, eventDays, type EventsResponse } from '@/lib/event-shared'

let cache: Promise<EventsResponse> | null = null

const load = () => {
  if (!cache) {
    cache = fetch('/api/events', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : { events: [], current: null }))
      .catch(() => {
        cache = null
        return { events: [], current: null }
      })
  }
  return cache
}

export function useEvents(): EventsResponse & { loaded: boolean } {
  const [data, setData] = useState<EventsResponse & { loaded: boolean }>({ events: [], current: null, loaded: false })
  useEffect(() => {
    let alive = true
    load().then(d => alive && setData({ ...d, loaded: true }))
    return () => {
      alive = false
    }
  }, [])
  return data
}

export function useCurrentEvent() {
  const { current, loaded } = useEvents()
  return { event: current, loaded, readOnly: current?.status === 'CLOSED' }
}

// イベントを切り替えて、画面を読み込み直す（全画面のデータが新しいイベントのものになる）
export async function switchEvent(id: number) {
  const res = await fetch('/api/events/current', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error('イベントの切り替えに失敗しました')
  cache = null
  window.location.reload()
}

// イベントの日付の一覧と表示名（スケジュールの日付タブなど）
export function useEventDays() {
  const { event } = useCurrentEvent()
  return {
    days: event ? eventDays(event) : [],
    dayName: (dayNo: number) => (event ? dayLabel(event, dayNo) : ''),
  }
}
