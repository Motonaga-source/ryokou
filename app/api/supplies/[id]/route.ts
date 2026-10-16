import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// PUT /api/supplies/:id  品名を編集（管理者のみ）
// body: { itemName: string }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const itemName = typeof body.itemName === 'string' ? body.itemName.trim() : ''
  if (!itemName) {
    return NextResponse.json({ error: '品名を入力してください' }, { status: 400 })
  }

  const { count } = await prisma.supplyItem.updateMany({
    where: { id: parseInt(id) },
    data: { itemName },
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
