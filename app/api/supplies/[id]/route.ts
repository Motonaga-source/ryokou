import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// PATCH /api/supplies/:id  チェック状態の切り替え
// 現場スタッフが一般画面からも操作するため、管理者ログインは不要
// body: { isChecked: boolean }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  if (typeof body.isChecked !== 'boolean') {
    return NextResponse.json({ error: 'isChecked が不正です' }, { status: 400 })
  }

  const { count } = await prisma.supplyItem.updateMany({
    where: { id: parseInt(id) },
    data: { isChecked: body.isChecked },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}

// DELETE /api/supplies/:id  持ち物を削除（管理者のみ）
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  await prisma.supplyItem.deleteMany({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}
