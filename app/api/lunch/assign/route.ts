import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// PUT /api/lunch/assign
// body: { tripId?: number, personId: number, tableId: number | null }
// tableId が null の場合は割り当てを解除。定員・車椅子枠の超過は画面で警告するのみで、割り当ては許容する
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

  if (tableId === null) {
    await prisma.lunchSeatAssignment.deleteMany({ where: { tripId, personId } })
    return NextResponse.json({ success: true })
  }

  const table = Number.isInteger(tableId)
    ? await prisma.lunchTable.findFirst({ where: { id: tableId, tripId } })
    : null
  if (!table) {
    return NextResponse.json({ error: 'tableId が不正です' }, { status: 400 })
  }

  await prisma.lunchSeatAssignment.upsert({
    where: { tripId_personId: { tripId, personId } },
    create: { tripId, personId, tableId },
    update: { tableId },
  })
  return NextResponse.json({ success: true })
}
