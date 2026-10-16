export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isSupplyCategory, type SuppliesResponse } from '@/lib/supplies'

// GET /api/supplies?tripId=1  持ち物と車椅子の準備状況
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const [items, wheelchairs] = await Promise.all([
    prisma.supplyItem.findMany({
      where: { tripId },
      select: { id: true, itemName: true, category: true, isChecked: true },
      orderBy: { id: 'asc' },
    }),
    prisma.person.findMany({
      where: {
        participations: { some: { tripId, status: '参加' } },
        OR: [{ isWheelchair: true }, { wheelchairSource: { not: null } }],
      },
      select: { id: true, name: true, isWheelchair: true, wheelchairSource: true, wheelchairPrepared: true },
      orderBy: { id: 'asc' },
    }),
  ])

  const body: SuppliesResponse = { items, wheelchairs }
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
  const tripId = Number(body.tripId) || 1
  const itemName = typeof body.itemName === 'string' ? body.itemName.trim() : ''
  if (!itemName) {
    return NextResponse.json({ error: '品名を入力してください' }, { status: 400 })
  }
  if (!isSupplyCategory(body.category)) {
    return NextResponse.json({ error: 'category が不正です' }, { status: 400 })
  }

  const item = await prisma.supplyItem.create({
    data: { tripId, itemName, category: body.category },
    select: { id: true, itemName: true, category: true, isChecked: true },
  })
  return NextResponse.json(item)
}
