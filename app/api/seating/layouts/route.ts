import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { parseLayoutInput } from '@/lib/seating'
import { badRequest, requireAdmin } from '@/lib/admin-api'

// POST /api/seating/layouts  配置図を追加（管理者のみ）。末尾に並ぶ
// body: { name, width?, height? }
export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const input = parseLayoutInput(await request.json())
  if (typeof input === 'string') return badRequest(input)

  const tripId = await resolveTripId(request)
  const last = await prisma.seatLayout.aggregate({ where: { tripId }, _max: { sortOrder: true } })
  const layout = await prisma.seatLayout.create({ data: { tripId, ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 } })
  return NextResponse.json({ id: layout.id }, { status: 201 })
}
