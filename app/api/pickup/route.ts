export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PickupResponse } from '@/lib/pickup'
import { resolveTripId } from '@/lib/event'

// GET /api/pickup?tripId=1  送迎車の設定と、集合・送迎の割り当て一覧
export async function GET(request: Request) {
  const tripId = await resolveTripId(request)

  const [vehicles, assignments] = await Promise.all([
    prisma.pickupVehicle.findMany({
      where: { tripId },
      select: { id: true, name: true, capacity: true, location: true },
      orderBy: { id: 'asc' },
    }),
    prisma.pickupAssignment.findMany({ where: { tripId }, select: { personId: true, groupId: true } }),
  ])

  const body: PickupResponse = { vehicles, assignments }
  return NextResponse.json(body)
}
