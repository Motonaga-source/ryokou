import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { normalizeMemo } from '@/lib/participation'
import { badRequest, notFound, requireAdmin } from '@/lib/transport-server'

// PUT /api/transport/memo/:personId  このイベントの送迎メモを保存（管理者のみ。空なら削除）
// body: { pickupMemo: string }
export async function PUT(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const memo = normalizeMemo(body.pickupMemo)
  if (memo === undefined) return badRequest('pickupMemo を指定してください')
  if (memo && memo.length > 200) return badRequest('送迎メモは200文字以内にしてください')

  const { personId } = await params
  const tripId = await resolveTripId(request)
  const { count } = await prisma.tripParticipation.updateMany({
    where: { tripId, personId: parseInt(personId) },
    data: { pickupMemo: memo },
  })
  if (count === 0) return notFound('このイベントの参加者')
  return NextResponse.json({ success: true })
}
