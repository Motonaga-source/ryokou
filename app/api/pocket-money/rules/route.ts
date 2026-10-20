export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { AllowanceRule } from '@/lib/allowance'

// GET /api/pocket-money/rules?tripId=1  参加する利用者の小遣いの事前ルール（管理者のみ）
export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const rules: AllowanceRule[] = await prisma.person.findMany({
    where: { role: 'USER', participations: { some: { tripId, status: '参加' } } },
    select: { id: true, name: true, facility: true, allowanceManagementType: true, allowanceRequiresCollection: true },
    orderBy: [{ facility: 'asc' }, { id: 'asc' }],
  })
  return NextResponse.json(rules)
}
