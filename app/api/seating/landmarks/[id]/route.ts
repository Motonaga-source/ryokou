import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { parseLandmarkInput, parsePosition } from '@/lib/seating'
import { badRequest, notFound, requireAdmin } from '@/lib/admin-api'

// PUT /api/seating/landmarks/:id  目印を変更（管理者のみ）
// - 位置だけ: body { x, y }（配置モードのドラッグ）
// - 内容: body { kind, label, w, h }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const { id } = await params
  const tripId = await resolveTripId(request)
  const landmark = await prisma.seatLandmark.findFirst({ where: { id: parseInt(id), tripId }, include: { layout: true } })
  if (!landmark) return notFound('目印')

  const positionOnly = Object.keys(body).every(k => k === 'x' || k === 'y')
  if (positionOnly) {
    const pos = parsePosition(body, landmark, landmark.layout)
    if (!pos) return badRequest('位置が不正です')
    await prisma.seatLandmark.update({ where: { id: landmark.id }, data: pos })
    return NextResponse.json({ success: true, ...pos })
  }

  const input = parseLandmarkInput(body)
  if (typeof input === 'string') return badRequest(input)
  const w = Math.min(input.w, landmark.layout.width)
  const h = Math.min(input.h, landmark.layout.height)
  const pos = parsePosition(landmark, { w, h }, landmark.layout) ?? { x: landmark.x, y: landmark.y }
  await prisma.seatLandmark.update({ where: { id: landmark.id }, data: { ...input, w, h, ...pos } })
  return NextResponse.json({ success: true })
}

// DELETE /api/seating/landmarks/:id  目印を削除（管理者のみ）
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const tripId = await resolveTripId(request)
  const { count } = await prisma.seatLandmark.deleteMany({ where: { id: parseInt(id), tripId } })
  if (count === 0) return notFound('目印')
  return NextResponse.json({ success: true })
}
