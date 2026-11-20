export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getCurrentEvent, listEvents } from '@/lib/event'
import type { EventsResponse } from '@/lib/event-shared'
import { fromJstDate, parseEventInput, toJstDate, type EventDetail } from '@/lib/event-input'

const unauthorized = () => NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })

// GET /api/events  イベント一覧と、いま選んでいるイベント
// GET /api/events?detail=1  イベント管理画面用の詳細一覧（管理者のみ）
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('detail')) {
      const session = await getSession()
      if (!session?.isAdmin) return unauthorized()
      const order = (await listEvents()).map(e => e.id)
      const trips = await prisma.trip.findMany({
        include: { _count: { select: { participations: { where: { status: '参加' } } } } },
      })
      const details: EventDetail[] = order.map(id => {
        const t = trips.find(x => x.id === id)!
        return {
          id: t.id,
          name: t.name,
          destination: t.destination,
          startDate: toJstDate(t.startDate),
          endDate: toJstDate(t.endDate),
          travelFee: t.travelFee,
          pocketMoney: t.pocketMoney,
          dashboardNotes: t.dashboardNotes,
          modules: t.modules,
          status: t.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
          participants: t._count.participations,
        }
      })
      return NextResponse.json(details)
    }

    const [events, current] = await Promise.all([listEvents(), getCurrentEvent()])
    const body: EventsResponse = { events, current }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Events GET error:', error)
    return NextResponse.json({ error: 'イベントの取得に失敗しました' }, { status: 500 })
  }
}

// POST /api/events  新しいイベントを作る（管理者のみ）。作ったイベントは「開催予定」
// body: { name, destination, startDate: "YYYY-MM-DD", endDate, travelFee?, pocketMoney?, dashboardNotes?, modules: string[] }
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) return unauthorized()

  const input = parseEventInput(await request.json())
  if (typeof input === 'string') return NextResponse.json({ error: input }, { status: 400 })

  const trip = await prisma.trip.create({
    data: {
      ...input,
      startDate: fromJstDate(input.startDate),
      endDate: fromJstDate(input.endDate),
      status: 'ACTIVE',
    },
  })
  return NextResponse.json({ id: trip.id }, { status: 201 })
}
