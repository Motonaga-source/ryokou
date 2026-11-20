import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { parseSectionInput } from '@/lib/transport'
import { badRequest, notFound, requireAdmin } from '@/lib/transport-server'

// PUT /api/transport/sections/:id  拠点の名前・時刻・メモを変更（管理者のみ）
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const input = parseSectionInput(await request.json())
  if (typeof input === 'string') return badRequest(input)

  const { id } = await params
  const tripId = await resolveTripId(request)
  const { count } = await prisma.groupSection.updateMany({ where: { id: parseInt(id), tripId }, data: input })
  if (count === 0) return notFound('拠点')
  return NextResponse.json({ success: true })
}

// DELETE /api/transport/sections/:id  拠点を削除（管理者のみ）。中の枠も消え、乗っていた人は未割り当てに戻る
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const tripId = await resolveTripId(request)
  const { count } = await prisma.groupSection.deleteMany({ where: { id: parseInt(id), tripId } })
  if (count === 0) return notFound('拠点')
  return NextResponse.json({ success: true })
}
