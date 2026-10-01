export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request) {
  const body = await request.json()
  // body: { tripId, personId, carId: number | null }

  const tripId = body.tripId || 1

  // 既存の車の割り当てを解除
  await prisma.carAssignment.deleteMany({
    where: { personId: body.personId }
  })

  // 新しい車が指定されていれば割り当て、バスの割り当てを解除
  if (body.carId) {
    const assignment = await prisma.carAssignment.create({
      data: {
        carId: body.carId,
        personId: body.personId
      }
    })

    // 排他制御: 乗用車に乗ったのでバスの割り当てを削除
    await prisma.busSeatAssignment.deleteMany({
      where: { tripId, personId: body.personId }
    })

    return NextResponse.json(assignment)
  }

  return NextResponse.json({ success: true })
}
