import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { badRequest, requireAdmin } from '@/lib/transport-server'

// PUT /api/transport/reorder  拠点、または1つの拠点の中の枠の並び順を保存（管理者のみ）
// body: { type: "sections", ids: number[] } | { type: "slots", sectionId: number, ids: number[] }
// ids は並べたい順のすべての ID（過不足があればエラー）
export async function PUT(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number) : []
  const tripId = await resolveTripId(request)

  const current =
    body.type === 'sections'
      ? await prisma.groupSection.findMany({ where: { tripId }, select: { id: true } })
      : body.type === 'slots'
        ? await prisma.groupSlot.findMany({ where: { tripId, sectionId: Number(body.sectionId) || 0 }, select: { id: true } })
        : null
  if (!current) return badRequest('type が不正です')
  const known = new Set(current.map(x => x.id))
  if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every(id => known.has(id))) {
    return badRequest('並び順の指定が一覧と一致しません。画面を読み込み直してください')
  }

  await prisma.$transaction(
    ids.map((id, i) =>
      body.type === 'sections'
        ? prisma.groupSection.update({ where: { id }, data: { sortOrder: i } })
        : prisma.groupSlot.update({ where: { id }, data: { sortOrder: i } })
    )
  )
  return NextResponse.json({ success: true })
}
