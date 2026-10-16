import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isWheelchairSource } from '@/lib/supplies'

// PATCH /api/supplies/wheelchairs/:personId
// body: { wheelchairPrepared?: boolean, wheelchairSource?: "グレイス貸出" | "持参" | null }
// 準備済みチェックは一般画面からも操作できる。車椅子の出所の変更は管理者のみ
export async function PATCH(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params
  const body = await request.json()
  const data: { wheelchairPrepared?: boolean; wheelchairSource?: string | null } = {}

  if ('wheelchairPrepared' in body) {
    if (typeof body.wheelchairPrepared !== 'boolean') {
      return NextResponse.json({ error: 'wheelchairPrepared が不正です' }, { status: 400 })
    }
    data.wheelchairPrepared = body.wheelchairPrepared
  }

  if ('wheelchairSource' in body) {
    const session = await getSession()
    if (!session?.isAdmin) {
      return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
    }
    const source = body.wheelchairSource ?? null
    if (source !== null && !isWheelchairSource(source)) {
      return NextResponse.json({ error: 'wheelchairSource が不正です' }, { status: 400 })
    }
    data.wheelchairSource = source
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })
  }

  const { count } = await prisma.person.updateMany({ where: { id: parseInt(personId) }, data })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
