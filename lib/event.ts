// イベント（Trip）の切り替えと閲覧専用の判定（サーバー側専用）
// 画面で選んでいるイベントは Cookie "event-id" に保存する。未選択・存在しない ID のときは既定のイベントを使う
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { EVENT_COOKIE, type EventSummary } from '@/lib/event-shared'

const toSummary = (t: { id: number; name: string; startDate: Date; endDate: Date; status: string }): EventSummary => ({
  id: t.id,
  name: t.name,
  startDate: t.startDate.toISOString(),
  endDate: t.endDate.toISOString(),
  status: t.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
})

// イベント一覧（開催予定 → 終了、それぞれ並び順・開催日順）
export async function listEvents(): Promise<EventSummary[]> {
  const trips = await prisma.trip.findMany({
    select: { id: true, name: true, startDate: true, endDate: true, status: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }],
  })
  const active = trips.filter(t => t.status !== 'CLOSED')
  const closed = trips.filter(t => t.status === 'CLOSED').reverse() // 終了したものは新しい順
  return [...active, ...closed].map(toSummary)
}

// Cookie の値（文字列）から使うイベントを決める。proxy.ts からも使う
// 指定が無効なときの既定: 開催予定のうち最も早いもの → なければ最後に終了したもの
export async function resolveEvent(cookieValue: string | undefined | null): Promise<EventSummary | null> {
  const requested = Number(cookieValue)
  if (Number.isInteger(requested) && requested > 0) {
    const trip = await prisma.trip.findUnique({ where: { id: requested } })
    if (trip) return toSummary(trip)
  }
  return (await listEvents())[0] ?? null
}

// サーバーコンポーネント・API から、いま選ばれているイベントを取得する
export async function getCurrentEvent(): Promise<EventSummary | null> {
  const store = await cookies()
  return resolveEvent(store.get(EVENT_COOKIE)?.value)
}

export async function getCurrentEventId(): Promise<number> {
  const event = await getCurrentEvent()
  if (!event) throw new Error('イベントが登録されていません')
  return event.id
}

// API で使うイベント ID を決める
// - 読み取り（GET）: クエリ ?tripId= があればそのイベント、なければ選択中のイベント
// - 書き込み: 必ず選択中のイベント（閲覧専用の判定 proxy.ts と同じ基準にするため、ボディの tripId は使わない）
export async function resolveTripId(request: Request): Promise<number> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const fromQuery = Number(new URL(request.url).searchParams.get('tripId'))
    if (Number.isInteger(fromQuery) && fromQuery > 0) return fromQuery
  }
  return getCurrentEventId()
}
