import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { parsePosition, parseTableInput, tableGeometry } from '@/lib/seating'
import { badRequest, notFound, requireAdmin } from '@/lib/admin-api'

// PUT /api/seating/tables/:id  テーブルを変更（管理者のみ）
// - 位置だけ: body { x, y }（配置モードのドラッグ）
// - 内容: body { name, shape, seats, wheelchairSlots, memo }（席数を減らすと、なくなる席の割り当ては外れる）
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const { id } = await params
  const tripId = await resolveTripId(request)
  const table = await prisma.seatTable.findFirst({ where: { id: parseInt(id), tripId }, include: { layout: true } })
  if (!table) return notFound('テーブル')

  const positionOnly = Object.keys(body).every(k => k === 'x' || k === 'y')
  if (positionOnly) {
    const pos = parsePosition(body, tableGeometry(table), table.layout)
    if (!pos) return badRequest('位置が不正です')
    await prisma.seatTable.update({ where: { id: table.id }, data: pos })
    return NextResponse.json({ success: true, ...pos })
  }

  const input = parseTableInput(body)
  if (typeof input === 'string') return badRequest(input)
  // 形・席数が変わって大きさが変わっても、配置図の中に収める
  const pos = parsePosition(table, tableGeometry(input), table.layout) ?? { x: table.x, y: table.y }
  const [removed] = await prisma.$transaction([
    prisma.seatAssignment.deleteMany({ where: { tableId: table.id, seatIndex: { gte: input.seats } } }),
    prisma.seatTable.update({ where: { id: table.id }, data: { ...input, ...pos } }),
  ])
  return NextResponse.json({ success: true, unassigned: removed.count })
}

// DELETE /api/seating/tables/:id  テーブルを削除（管理者のみ）。座っていた人は未配置に戻る
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const tripId = await resolveTripId(request)
  const { count } = await prisma.seatTable.deleteMany({ where: { id: parseInt(id), tripId } })
  if (count === 0) return notFound('テーブル')
  return NextResponse.json({ success: true })
}
