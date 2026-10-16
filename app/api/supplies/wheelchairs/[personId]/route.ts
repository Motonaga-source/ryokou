import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isWheelchairSource } from '@/lib/supplies'

// PATCH /api/supplies/wheelchairs/:personId  車椅子の出所を設定（管理者のみ）
// body: { wheelchairSource: "グレイス貸出" | "持参" | null }
export async function PATCH(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { personId } = await params
  const body = await request.json()
  const source = body.wheelchairSource ?? null
  if (source !== null && !isWheelchairSource(source)) {
    return NextResponse.json({ error: 'wheelchairSource が不正です' }, { status: 400 })
  }

  const { count } = await prisma.person.updateMany({
    where: { id: parseInt(personId) },
    data: { wheelchairSource: source },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
