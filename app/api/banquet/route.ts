export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'

// GET /api/banquet?tripId=1  宴会場の席の割り当て一覧
export async function GET(request: Request) {
  const tripId = await resolveTripId(request)

  const assignments = await prisma.banquetSeatAssignment.findMany({
    where: { tripId },
    select: { personId: true, seatId: true },
  })
  return NextResponse.json(assignments)
}
