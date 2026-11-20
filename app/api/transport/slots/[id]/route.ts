import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { parseSlotInput } from '@/lib/transport'
import { badRequest, notFound, requireAdmin } from '@/lib/transport-server'

// PUT /api/transport/slots/:id  枠の名前・種類・定員・色・メモを変更（管理者のみ）
// body.sectionId を指定すると別の拠点へ移す（移した先の末尾に並ぶ）
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const input = parseSlotInput(body)
  if (typeof input === 'string') return badRequest(input)

  const { id } = await params
  const tripId = await resolveTripId(request)
  const slot = await prisma.groupSlot.findFirst({ where: { id: parseInt(id), tripId } })
  if (!slot) return notFound('枠')

  let move = {}
  if (body.sectionId !== undefined && Number(body.sectionId) !== slot.sectionId) {
    const section = await prisma.groupSection.findFirst({ where: { id: Number(body.sectionId) || 0, tripId } })
    if (!section) return notFound('移動先の拠点')
    const last = await prisma.groupSlot.aggregate({ where: { sectionId: section.id }, _max: { sortOrder: true } })
    move = { sectionId: section.id, sortOrder: (last._max.sortOrder ?? -1) + 1 }
  }

  await prisma.groupSlot.update({ where: { id: slot.id }, data: { ...input, ...move } })
  return NextResponse.json({ success: true })
}

// DELETE /api/transport/slots/:id  枠を削除（管理者のみ）。乗っていた人は未割り当てに戻る
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const tripId = await resolveTripId(request)
  const { count } = await prisma.groupSlot.deleteMany({ where: { id: parseInt(id), tripId } })
  if (count === 0) return notFound('枠')
  return NextResponse.json({ success: true })
}
