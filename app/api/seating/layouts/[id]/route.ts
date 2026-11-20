import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { parseLayoutInput, tableGeometry } from '@/lib/seating'
import { badRequest, notFound, requireAdmin } from '@/lib/admin-api'

// PUT /api/seating/layouts/:id  配置図の名前・大きさを変更（管理者のみ）
// 小さくしてはみ出すテーブル・目印は、配置図の中に収まる位置へ寄せる
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const input = parseLayoutInput(await request.json())
  if (typeof input === 'string') return badRequest(input)

  const { id } = await params
  const tripId = await resolveTripId(request)
  const layout = await prisma.seatLayout.findFirst({ where: { id: parseInt(id), tripId }, include: { tables: true, landmarks: true } })
  if (!layout) return notFound('配置図')

  const fit = (x: number, y: number, w: number, h: number) => ({
    x: Math.max(0, Math.min(x, input.width - w)),
    y: Math.max(0, Math.min(y, input.height - h)),
  })
  await prisma.$transaction([
    prisma.seatLayout.update({ where: { id: layout.id }, data: input }),
    ...layout.tables.map(t => {
      const g = tableGeometry(t)
      return prisma.seatTable.update({ where: { id: t.id }, data: fit(t.x, t.y, g.w, g.h) })
    }),
    ...layout.landmarks.map(l => prisma.seatLandmark.update({ where: { id: l.id }, data: fit(l.x, l.y, l.w, l.h) })),
  ])
  return NextResponse.json({ success: true })
}

// DELETE /api/seating/layouts/:id  配置図を削除（管理者のみ）。中のテーブル・目印・割り当ても消える
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const tripId = await resolveTripId(request)
  const { count } = await prisma.seatLayout.deleteMany({ where: { id: parseInt(id), tripId } })
  if (count === 0) return notFound('配置図')
  return NextResponse.json({ success: true })
}
