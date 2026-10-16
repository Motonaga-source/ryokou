export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PickupResponse } from '@/lib/pickup'

// GET /api/pickup?tripId=1  送迎車の設定と、集合・送迎の割り当て一覧
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const [vehicles, assignments] = await Promise.all([
    prisma.pickupVehicle.findMany({ orderBy: { id: 'asc' } }),
    prisma.pickupAssignment.findMany({ where: { tripId }, select: { personId: true, groupId: true } }),
  ])

  const body: PickupResponse = { vehicles, assignments }
  return NextResponse.json(body)
}
