import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isBanquetSeatId, moveToSeat } from '@/lib/banquet'

// PUT /api/banquet/assign
// body: { tripId?: number, personId: number, seatId: string | null }
// 移動先の席に別の人がいる場合は入れ替え（移動元の席がなければその人は未割り当てへ）。seatId が null なら割り当て解除
export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const body = await request.json()
  const tripId = Number(body.tripId) || 1
  const personId = Number(body.personId)
  const seatId = body.seatId ?? null

  if (!personId) {
    return NextResponse.json({ error: 'personId が不正です' }, { status: 400 })
  }
  if (seatId !== null && !isBanquetSeatId(seatId)) {
    return NextResponse.json({ error: 'seatId が不正です' }, { status: 400 })
  }

  const current = await prisma.banquetSeatAssignment.findMany({
    where: { tripId },
    select: { personId: true, seatId: true },
  })
  const next = moveToSeat(current, personId, seatId)

  // 影響のある人（移動する本人と、入れ替え相手）の割り当てだけを入れ替える
  const affected = [personId, ...current.filter(a => a.seatId === seatId).map(a => a.personId)]
  await prisma.$transaction([
    prisma.banquetSeatAssignment.deleteMany({ where: { tripId, personId: { in: affected } } }),
    prisma.banquetSeatAssignment.createMany({
      data: next.filter(a => affected.includes(a.personId)).map(a => ({ tripId, ...a })),
    }),
  ])

  return NextResponse.json({ success: true })
}
