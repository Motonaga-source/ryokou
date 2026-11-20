export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isSupplyCategory, type SuppliesResponse } from '@/lib/supplies'
import { resolveTripId } from '@/lib/event'

// GET /api/supplies?tripId=1  持ち物と、車椅子利用者の車椅子の出所
export async function GET(request: Request) {
  const tripId = await resolveTripId(request)

  const [items, wheelchairs] = await Promise.all([
    prisma.supplyItem.findMany({
      where: { tripId },
      select: { id: true, itemName: true, category: true },
      orderBy: { id: 'asc' },
    }),
    // 車椅子の出所は、このイベントの参加レコードの値
    prisma.tripParticipation.findMany({
      where: {
        tripId,
        status: '参加',
        OR: [{ person: { isWheelchair: true } }, { wheelchairSource: { not: null } }],
      },
      select: { wheelchairSource: true, person: { select: { id: true, name: true, isWheelchair: true } } },
      orderBy: { personId: 'asc' },
    }),
  ])

  const body: SuppliesResponse = {
    items,
    wheelchairs: wheelchairs.map(w => ({ ...w.person, wheelchairSource: w.wheelchairSource })),
  }
  return NextResponse.json(body)
}

// POST /api/supplies  持ち物を追加（管理者のみ）
// body: { tripId?: number, itemName: string, category: "共通備品" | "施設別の薬" }
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const body = await request.json()
  const tripId = await resolveTripId(request)
  const itemName = typeof body.itemName === 'string' ? body.itemName.trim() : ''
  if (!itemName) {
    return NextResponse.json({ error: '品名を入力してください' }, { status: 400 })
  }
  if (!isSupplyCategory(body.category)) {
    return NextResponse.json({ error: 'category が不正です' }, { status: 400 })
  }

  const item = await prisma.supplyItem.create({
    data: { tripId, itemName, category: body.category },
    select: { id: true, itemName: true, category: true },
  })
  return NextResponse.json(item)
}
