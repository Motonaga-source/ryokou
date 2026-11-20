import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { parseSectionInput } from '@/lib/transport'
import { badRequest, requireAdmin } from '@/lib/transport-server'

// POST /api/transport/sections  拠点を追加（管理者のみ）。末尾に並ぶ
// body: { name, time?, memo? }
export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const input = parseSectionInput(await request.json())
  if (typeof input === 'string') return badRequest(input)

  const tripId = await resolveTripId(request)
  const last = await prisma.groupSection.aggregate({ where: { tripId }, _max: { sortOrder: true } })
  const section = await prisma.groupSection.create({
    data: { tripId, ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  })
  return NextResponse.json({ id: section.id }, { status: 201 })
}
