import { NextResponse } from 'next/server'
import { getCurrentEvent, listEvents } from '@/lib/event'
import type { EventsResponse } from '@/lib/event-shared'

// イベント一覧と、いま選んでいるイベント
export async function GET() {
  try {
    const [events, current] = await Promise.all([listEvents(), getCurrentEvent()])
    const body: EventsResponse = { events, current }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Events GET error:', error)
    return NextResponse.json({ error: 'イベントの取得に失敗しました' }, { status: 500 })
  }
}
