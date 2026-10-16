export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { parseScheduleInput, placeByTime } from '@/lib/schedule'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const schedules = await prisma.schedule.findMany({
    where: { tripId },
    orderBy: [{ dayNo: 'asc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json(schedules)
}

// POST /api/schedule  スケジュールを追加（時刻順の位置に挿入）
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const body = await request.json()
  const tripId = Number(body.tripId) || 1
  const input = parseScheduleInput(body)
  if (typeof input === 'string') {
    return NextResponse.json({ error: input }, { status: 400 })
  }

  const schedule = await prisma.schedule.create({ data: { tripId, ...input, sortOrder: 0 } })
  await placeByTime(tripId, input.dayNo, schedule.id)
  return NextResponse.json(schedule)
}
