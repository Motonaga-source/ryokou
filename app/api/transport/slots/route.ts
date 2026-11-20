import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { parseSlotInput } from '@/lib/transport'
import { badRequest, notFound, requireAdmin } from '@/lib/transport-server'

// POST /api/transport/slots  拠点に枠（車・徒歩など）を追加（管理者のみ）。拠点の末尾に並ぶ
// body: { sectionId, name, kind: "car" | "walk" | "other", capacity?, color?, memo? }
export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const input = parseSlotInput(body)
  if (typeof input === 'string') return badRequest(input)

  const tripId = await resolveTripId(request)
  const section = await prisma.groupSection.findFirst({ where: { id: Number(body.sectionId) || 0, tripId } })
  if (!section) return notFound('拠点')

  const last = await prisma.groupSlot.aggregate({ where: { sectionId: section.id }, _max: { sortOrder: true } })
  const slot = await prisma.groupSlot.create({
    data: { tripId, sectionId: section.id, ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  })
  return NextResponse.json({ id: slot.id }, { status: 201 })
}
