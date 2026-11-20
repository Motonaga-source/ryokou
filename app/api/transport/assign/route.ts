import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { badRequest, notFound, requireAdmin, renumberSlot } from '@/lib/transport-server'

// PUT /api/transport/assign  参加者を枠に割り当てる・移す・外す（管理者のみ）
// body: { personId, slotId: number | null, index?: number }
//   slotId が null なら割り当てを外す（未割り当てへ）。index は枠の中の位置（省略時は末尾）
// 定員を超えても割り当ては保存する（画面で警告を出す）
export async function PUT(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const personId = Number(body.personId)
  if (!Number.isInteger(personId) || personId <= 0) return badRequest('personId が不正です')
  const tripId = await resolveTripId(request)

  const current = await prisma.groupAssignment.findUnique({ where: { tripId_personId: { tripId, personId } } })

  if (body.slotId === null) {
    if (current) {
      await prisma.groupAssignment.delete({ where: { id: current.id } })
      const rest = await prisma.groupAssignment.findMany({ where: { tripId, slotId: current.slotId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
      await renumberSlot(tripId, current.slotId, rest.map(a => a.personId))
    }
    return NextResponse.json({ success: true })
  }

  const slot = await prisma.groupSlot.findFirst({ where: { id: Number(body.slotId) || 0, tripId } })
  if (!slot) return notFound('枠')
  const participating = await prisma.tripParticipation.findFirst({ where: { tripId, personId, status: '参加' } })
  if (!participating) return badRequest('このイベントに「参加」の人だけ割り当てられます')

  // 移動先の枠の並び（自分を除く）に、指定の位置で差し込む
  const members = await prisma.groupAssignment.findMany({
    where: { tripId, slotId: slot.id, personId: { not: personId } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
  const order = members.map(a => a.personId)
  const index = Number.isInteger(body.index) ? Math.max(0, Math.min(order.length, body.index)) : order.length
  order.splice(index, 0, personId)

  await prisma.groupAssignment.upsert({
    where: { tripId_personId: { tripId, personId } },
    create: { tripId, personId, slotId: slot.id, sortOrder: index },
    update: { slotId: slot.id },
  })
  await renumberSlot(tripId, slot.id, order)
  if (current && current.slotId !== slot.id) {
    const rest = await prisma.groupAssignment.findMany({ where: { tripId, slotId: current.slotId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
    await renumberSlot(tripId, current.slotId, rest.map(a => a.personId))
  }
  return NextResponse.json({ success: true })
}
