import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canRequireCollection, isAllowanceType } from '@/lib/allowance'

// PUT /api/pocket-money/rules/:personId  小遣いの管理区分と事後回収の要否を保存（管理者のみ）
// body: { allowanceManagementType: "STAFF" | "USER" | "SELF" | null, allowanceRequiresCollection: boolean }
// 自己管理（法人準備なし）の場合、事後回収は常に「不要」として保存する
export async function PUT(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { personId } = await params
  const body = await request.json()
  const type = body.allowanceManagementType ?? null
  if (type !== null && !isAllowanceType(type)) {
    return NextResponse.json({ error: '管理区分が不正です' }, { status: 400 })
  }
  if (typeof body.allowanceRequiresCollection !== 'boolean') {
    return NextResponse.json({ error: '回収の要否が不正です' }, { status: 400 })
  }

  const { count } = await prisma.person.updateMany({
    where: { id: parseInt(personId), role: 'USER' },
    data: {
      allowanceManagementType: type,
      allowanceRequiresCollection: canRequireCollection(type) && body.allowanceRequiresCollection,
    },
  })
  if (count === 0) return NextResponse.json({ error: '利用者が見つかりません' }, { status: 404 })
  return NextResponse.json({ success: true })
}
