export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCorporateAllowance } from '@/lib/allowance'

// GET /api/pocket-money?tripId=1  参加する利用者の小遣い（支給額・使用額・残額）と管理区分
// 支給額は利用者ごとに個別に設定する。未設定の人は allocated が null（一律の初期値は使わない）
// 合計は、法人がお金を預かる人（自己管理以外）で支給額が設定済みの人だけを対象にする
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const persons = await prisma.person.findMany({
    where: {
      role: 'USER',
      participations: { some: { tripId, status: '参加' } },
    },
    include: { pocketMoneyRecord: true },
    orderBy: [{ facility: 'asc' }, { id: 'asc' }],
  })

  let totalAllocated = 0
  let totalUsed = 0

  const records = persons.map(person => {
    const rec = person.pocketMoneyRecord
    const corporate = isCorporateAllowance(person.allowanceManagementType)
    const allocated = rec ? rec.allocated : null
    const used = rec ? rec.used : 0
    if (corporate && allocated !== null) {
      totalAllocated += allocated
      totalUsed += used
    }

    return {
      id: person.id,
      allocated,
      used,
      remaining: allocated === null ? null : allocated - used,
      person: {
        id: person.id,
        name: person.name,
        gender: person.gender,
        facility: person.facility,
        isWheelchair: person.isWheelchair,
        // 小遣いの事前ルール（一般画面の管理区分ごとの表示に使う）
        allowanceManagementType: person.allowanceManagementType,
        allowanceRequiresCollection: person.allowanceRequiresCollection,
      },
    }
  })

  return NextResponse.json({
    records,
    total: {
      allocated: totalAllocated,
      used: totalUsed,
      remaining: totalAllocated - totalUsed,
    },
    // 法人がお金を預かる人のうち、支給額が未設定の人数
    unsetCount: records.filter(r => r.allocated === null && isCorporateAllowance(r.person.allowanceManagementType)).length,
  })
}
