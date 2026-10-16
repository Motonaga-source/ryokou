export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isMenuPath } from '@/lib/menu'

// GET /api/menu-order  保存済みのメニュー並び順（path の配列）
export async function GET() {
  const rows = await prisma.menuOrder.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ order: rows.map(r => r.path) })
}

// PUT /api/menu-order  メニュー並び順を一括更新（管理者のみ）
// body: { order: string[] }  一般画面のパスを表示したい順に並べた配列
export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const body = await request.json()
  const order: unknown = body.order
  if (!Array.isArray(order) || !order.every(isMenuPath) || new Set(order).size !== order.length) {
    return NextResponse.json({ error: 'order が不正です' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.menuOrder.deleteMany({}),
    prisma.menuOrder.createMany({ data: order.map((path, i) => ({ path, sortOrder: i })) }),
  ])
  return NextResponse.json({ order })
}
