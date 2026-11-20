import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { getSession } from '@/lib/auth'

// PUT /api/roll-call/:personId  点呼チェックを設定（管理者のみ）
// body: { isRollCalled: boolean }
export async function PUT(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { personId } = await params
  const body = await request.json()
  if (typeof body.isRollCalled !== 'boolean') {
    return NextResponse.json({ error: 'isRollCalled が不正です' }, { status: 400 })
  }

  // このイベントの参加レコードに保存する
  const tripId = await resolveTripId(request)
  const { count } = await prisma.tripParticipation.updateMany({
    where: { tripId, personId: parseInt(personId) },
    data: { isRollCalled: body.isRollCalled },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
