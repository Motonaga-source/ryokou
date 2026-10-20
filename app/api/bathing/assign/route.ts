export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isBathingRole, isBanNumber } from '@/lib/bathing'

// PUT /api/bathing/assign
// body: { tripId?: number, personId: number, role?: BathingRole | null, banNumber?: 1 | 2 | 3 | null }
// role が null の場合は割り当てを解除（未割り当てへ移動）
// role を省略して banNumber のみ送った場合は、既存の割り当ての班だけを更新
// 班（入浴の順番）は利用者だけのもの。スタッフは班に関係なく担当するため、スタッフの班は常に空にする
export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const body = await request.json()
  const tripId = Number(body.tripId) || 1
  const personId = Number(body.personId)
  const role = body.role ?? null

  if (!personId) {
    return NextResponse.json({ error: 'personId が不正です' }, { status: 400 })
  }

  const person = await prisma.person.findUnique({ where: { id: personId }, select: { role: true } })
  if (!person) {
    return NextResponse.json({ error: '参加者が見つかりません' }, { status: 404 })
  }
  const staff = person.role === 'STAFF'

  if (!('role' in body)) {
    const banNumber = body.banNumber ?? null
    if (banNumber !== null && !isBanNumber(banNumber)) {
      return NextResponse.json({ error: 'banNumber が不正です' }, { status: 400 })
    }
    if (staff && banNumber !== null) {
      return NextResponse.json({ error: 'スタッフには班を設定できません（班は利用者の入浴の順番です）' }, { status: 400 })
    }
    const { count } = await prisma.bathingAssignment.updateMany({
      where: { tripId, personId, role: { not: null } },
      data: { banNumber },
    })
    if (count === 0) {
      return NextResponse.json({ error: '役割が割り当てられていないため班を設定できません' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  }

  if (role !== null && !isBathingRole(role)) {
    return NextResponse.json({ error: 'role が不正です' }, { status: 400 })
  }

  if (role === null) {
    await prisma.bathingAssignment.deleteMany({ where: { tripId, personId } })
    return NextResponse.json({ success: true })
  }

  const assignment = await prisma.bathingAssignment.upsert({
    where: { tripId_personId: { tripId, personId } },
    create: { tripId, personId, role },
    update: staff ? { role, banNumber: null } : { role },
  })
  return NextResponse.json(assignment)
}
