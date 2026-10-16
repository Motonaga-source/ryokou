import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isFixedPickupGroupId, vehicleIdOf } from '@/lib/pickup'

// PUT /api/pickup/assign
// body: { tripId?: number, personId: number, groupId: string | null }
// groupId が null の場合は割り当てを解除（未割り当てへ移動）
export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const body = await request.json()
  const tripId = Number(body.tripId) || 1
  const personId = Number(body.personId)
  const groupId = body.groupId ?? null

  if (!personId) {
    return NextResponse.json({ error: 'personId が不正です' }, { status: 400 })
  }
  if (groupId !== null && !isFixedPickupGroupId(groupId)) {
    // 送迎車の場合は登録済みの車両か確認
    const vehicleId = typeof groupId === 'string' ? vehicleIdOf(groupId) : null
    const vehicle = vehicleId ? await prisma.pickupVehicle.findUnique({ where: { id: vehicleId } }) : null
    if (!vehicle) {
      return NextResponse.json({ error: 'groupId が不正です' }, { status: 400 })
    }
  }

  if (groupId === null) {
    await prisma.pickupAssignment.deleteMany({ where: { tripId, personId } })
    return NextResponse.json({ success: true })
  }

  await prisma.pickupAssignment.upsert({
    where: { tripId_personId: { tripId, personId } },
    create: { tripId, personId, groupId },
    update: { groupId },
  })
  return NextResponse.json({ success: true })
}
