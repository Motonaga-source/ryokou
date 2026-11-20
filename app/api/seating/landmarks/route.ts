import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { parseLandmarkInput, parsePosition } from '@/lib/seating'
import { badRequest, notFound, requireAdmin } from '@/lib/admin-api'

// POST /api/seating/landmarks  配置図に目印（入口・レジなど）を追加（管理者のみ）
// body: { layoutId, kind, label?, w?, h?, x?, y? }
export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const input = parseLandmarkInput(body)
  if (typeof input === 'string') return badRequest(input)

  const tripId = await resolveTripId(request)
  const layout = await prisma.seatLayout.findFirst({ where: { id: Number(body.layoutId) || 0, tripId } })
  if (!layout) return notFound('配置図')

  const pos = parsePosition({ x: body.x ?? 20, y: body.y ?? 20 }, input, layout) ?? { x: 20, y: 20 }
  const landmark = await prisma.seatLandmark.create({ data: { tripId, layoutId: layout.id, ...input, ...pos } })
  return NextResponse.json({ id: landmark.id }, { status: 201 })
}
