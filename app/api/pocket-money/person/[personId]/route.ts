import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { MAX_ALLOWANCE_YEN, isCorporateAllowance } from '@/lib/allowance'

const isYen = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_ALLOWANCE_YEN

// PUT /api/pocket-money/person/:personId  利用者ごとの支給額・使用額を保存（管理者のみ）
// body: { allocated: number, used: number }  残額は常に「支給額 − 使用額」で計算して保存する
// 自己管理（法人準備なし）の人は法人がお金を預からないため設定できない
export async function PUT(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { personId } = await params
  const id = parseInt(personId)
  const body = await request.json()
  const tripId = Number(body.tripId) || 1

  if (!isYen(body.allocated)) {
    return NextResponse.json({ error: `支給額は0〜${MAX_ALLOWANCE_YEN.toLocaleString()}円の整数で入力してください` }, { status: 400 })
  }
  if (!isYen(body.used)) {
    return NextResponse.json({ error: `使用額は0〜${MAX_ALLOWANCE_YEN.toLocaleString()}円の整数で入力してください` }, { status: 400 })
  }

  const person = await prisma.person.findFirst({ where: { id, role: 'USER' }, select: { allowanceManagementType: true } })
  if (!person) {
    return NextResponse.json({ error: '利用者が見つかりません' }, { status: 404 })
  }
  if (!isCorporateAllowance(person.allowanceManagementType)) {
    return NextResponse.json({ error: '自己管理（法人準備なし）の方は支給額を設定できません' }, { status: 400 })
  }

  const data = { allocated: body.allocated, used: body.used, remaining: body.allocated - body.used }
  const record = await prisma.pocketMoneyRecord.upsert({
    where: { personId: id },
    create: { tripId, personId: id, ...data },
    update: data,
  })
  return NextResponse.json(record)
}
