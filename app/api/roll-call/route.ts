export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const unauthorized = () => NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })

// GET /api/roll-call?tripId=1  点呼対象（参加者）と、グループ分けに使う集合・送迎／チームの情報（管理者のみ）
export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) return unauthorized()

  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const [persons, vehicles, pickups, teams] = await Promise.all([
    prisma.person.findMany({
      where: { participations: { some: { tripId, status: '参加' } } },
      select: { id: true, name: true, role: true, gender: true, isWheelchair: true, isFishNG: true, isRollCalled: true },
      orderBy: { id: 'asc' },
    }),
    prisma.pickupVehicle.findMany({ orderBy: { id: 'asc' } }),
    prisma.pickupAssignment.findMany({ where: { tripId }, select: { personId: true, groupId: true } }),
    prisma.team.findMany({
      where: { tripId },
      select: { id: true, name: true, members: { select: { personId: true } } },
      orderBy: { id: 'asc' },
    }),
  ])

  return NextResponse.json({
    persons,
    vehicles,
    pickups,
    teams: teams.map(t => ({ id: t.id, name: t.name, memberIds: t.members.map(m => m.personId) })),
  })
}

// DELETE /api/roll-call?tripId=1  全員のチェックをクリア（次の点呼で使い回すため。管理者のみ）
export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) return unauthorized()

  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const { count } = await prisma.person.updateMany({
    where: { participations: { some: { tripId } }, isRollCalled: true },
    data: { isRollCalled: false },
  })
  return NextResponse.json({ success: true, cleared: count })
}
