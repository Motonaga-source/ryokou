import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// PUT /api/schedule/reorder
// body: { ids: number[] }  渡した順に sortOrder を 1 から振り直す（同じ日のスケジュールを想定）
export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const body = await request.json()
  const ids: unknown = body.ids
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(n => Number.isInteger(n))) {
    return NextResponse.json({ error: 'ids が不正です' }, { status: 400 })
  }

  await prisma.$transaction(
    ids.map((id: number, i) => prisma.schedule.update({ where: { id }, data: { sortOrder: i + 1 } }))
  )
  return NextResponse.json({ success: true })
}
