import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { badRequest, notFound, requireAdmin } from '@/lib/admin-api'

// PUT /api/seating/assign  参加者を席に座らせる・入れ替える・外す（管理者のみ）
// body: { layoutId, personId, tableId: number | null, seatIndex?: number }
//   tableId が null なら、その配置図での席を外す（未配置へ）
// 1つの席に1人・1つの配置図で1人1席（DB の一意制約でも守る）
//   空いている席 → 移動。ほかの人が座っている席 →
//     ・自分がすでにどこかに座っていれば、相手と席を入れ替える
//     ・自分が未配置なら、相手は未配置に戻る
// 車椅子枠かどうかは制限せず、画面で警告する
export async function PUT(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const personId = Number(body.personId)
  const layoutId = Number(body.layoutId)
  if (!Number.isInteger(personId) || personId <= 0) return badRequest('personId が不正です')
  const tripId = await resolveTripId(request)
  const layout = await prisma.seatLayout.findFirst({ where: { id: layoutId || 0, tripId } })
  if (!layout) return notFound('配置図')

  const mine = await prisma.seatAssignment.findUnique({ where: { layoutId_personId: { layoutId: layout.id, personId } } })

  if (body.tableId === null) {
    if (mine) await prisma.seatAssignment.delete({ where: { id: mine.id } })
    return NextResponse.json({ success: true })
  }

  const table = await prisma.seatTable.findFirst({ where: { id: Number(body.tableId) || 0, layoutId: layout.id } })
  if (!table) return notFound('テーブル')
  const seatIndex = Number(body.seatIndex)
  if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= table.seats) return badRequest('席の番号が不正です')
  const participating = await prisma.tripParticipation.findFirst({ where: { tripId, personId, status: '参加' } })
  if (!participating) return badRequest('このイベントに「参加」の人だけ席に座れます')

  if (mine && mine.tableId === table.id && mine.seatIndex === seatIndex) return NextResponse.json({ success: true })

  const occupant = await prisma.seatAssignment.findUnique({ where: { tableId_seatIndex: { tableId: table.id, seatIndex } } })
  const ops = []
  // いったん両方の行を消してから作り直す（一意制約にぶつからない順序）
  if (mine) ops.push(prisma.seatAssignment.delete({ where: { id: mine.id } }))
  if (occupant) ops.push(prisma.seatAssignment.delete({ where: { id: occupant.id } }))
  ops.push(prisma.seatAssignment.create({ data: { tripId, layoutId: layout.id, tableId: table.id, seatIndex, personId } }))
  if (occupant && mine) {
    ops.push(
      prisma.seatAssignment.create({
        data: { tripId, layoutId: layout.id, tableId: mine.tableId, seatIndex: mine.seatIndex, personId: occupant.personId },
      })
    )
  }
  await prisma.$transaction(ops)
  return NextResponse.json({ success: true, swapped: !!(occupant && mine), unseated: occupant && !mine ? occupant.personId : null })
}
