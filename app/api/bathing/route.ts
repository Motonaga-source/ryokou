export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'

export async function GET(request: Request) {
  const tripId = await resolveTripId(request)

  const assignments = await prisma.bathingAssignment.findMany({
    where: { tripId },
    include: { person: true },
  })
  return NextResponse.json(assignments)
}
