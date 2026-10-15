export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isBathingRole } from '@/lib/bathing'

// PUT /api/bathing/assign
// body: { tripId?: number, personId: number, role: BathingRole | null }
// role が null の場合は割り当てを解除（未割り当てへ移動）
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
    update: { role },
  })
  return NextResponse.json(assignment)
}
