import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isValidSeatIndex, moveToLunchSeat } from '@/lib/lunch'

// PUT /api/lunch/assign
// body: { tripId?: number, personId: number, tableId: number | null, seatIndex?: number }
// 指定した席へ配置する。席に別の人がいれば入れ替え（移動元の席がなければその人は未配置へ）。tableId が null なら配置解除
// 車椅子枠に車椅子以外の人が座る・車椅子利用者が普通の席に座る場合も、画面で警告するのみで配置は許容する
export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const body = await request.json()
  const tripId = Number(body.tripId) || 1
  const personId = Number(body.personId)
  const tableId = body.tableId ?? null

  if (!personId) {
    return NextResponse.json({ error: 'personId が不正です' }, { status: 400 })
  }

  let target: { tableId: number; seatIndex: number } | null = null
  if (tableId !== null) {
    const table = Number.isInteger(tableId) ? await prisma.lunchTable.findFirst({ where: { id: tableId, tripId } }) : null
    if (!table) {
      return NextResponse.json({ error: 'tableId が不正です' }, { status: 400 })
    }
    if (!isValidSeatIndex(table, body.seatIndex)) {
      return NextResponse.json({ error: 'seatIndex が不正です' }, { status: 400 })
    }
    target = { tableId, seatIndex: body.seatIndex }
  }

  const current = await prisma.lunchSeatAssignment.findMany({
    where: { tripId },
    select: { personId: true, tableId: true, seatIndex: true },
  })
  const next = moveToLunchSeat(current, personId, target)

  // 影響のある人（移動する本人と、入れ替え相手）の割り当てだけを入れ替える
  const affected = [
    personId,
    ...current.filter(a => target && a.tableId === target.tableId && a.seatIndex === target.seatIndex).map(a => a.personId),
  ]
  await prisma.$transaction([
    prisma.lunchSeatAssignment.deleteMany({ where: { tripId, personId: { in: affected } } }),
    prisma.lunchSeatAssignment.createMany({
      data: next.filter(a => affected.includes(a.personId)).map(a => ({ tripId, ...a })),
    }),
  ])

  return NextResponse.json({ success: true })
}
