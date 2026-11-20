export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { resolveTripId } from '@/lib/event'
import { isParticipationStatus, type ParticipationRow } from '@/lib/participation'

const unauthorized = () => NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })

// GET /api/participation  法人共通の名簿の全員と、選択中のイベントでの参加状況（管理者のみ）
export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) return unauthorized()

  const tripId = await resolveTripId(request)
  const persons = await prisma.person.findMany({
    select: {
      id: true, name: true, role: true, gender: true, facility: true, isWheelchair: true, isFishNG: true,
      participations: { where: { tripId }, select: { status: true } },
    },
    orderBy: [{ facility: 'asc' }, { id: 'asc' }],
  })
  const rows: ParticipationRow[] = persons.map(({ participations, ...p }) => ({ ...p, status: participations[0]?.status ?? null }))
  return NextResponse.json(rows)
}

// PUT /api/participation  選択中のイベントでの参加状況をまとめて設定（管理者のみ）
// body: { personIds: number[], status: "参加" | "不参加" | "保留" }
// 参加レコードがない人には作る。座席などの割り当ては消さない（「参加」の人だけが各画面に表示される）
export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) return unauthorized()

  const body = await request.json()
  const status = body.status
  const personIds: number[] = Array.isArray(body.personIds)
    ? [...new Set<number>(body.personIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))]
    : []
  if (!isParticipationStatus(status)) {
    return NextResponse.json({ error: '参加状況が不正です' }, { status: 400 })
  }
  if (personIds.length === 0) {
    return NextResponse.json({ error: '対象の人がいません' }, { status: 400 })
  }

  const tripId = await resolveTripId(request)
  const found = await prisma.person.count({ where: { id: { in: personIds } } })
  if (found !== personIds.length) {
    return NextResponse.json({ error: '名簿にない人が含まれています' }, { status: 400 })
  }

  await prisma.$transaction(
    personIds.map(personId =>
      prisma.tripParticipation.upsert({
        where: { tripId_personId: { tripId, personId } },
        update: { status },
        create: { tripId, personId, status },
      })
    )
  )
  return NextResponse.json({ success: true, count: personIds.length })
}
