export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const schedules = await prisma.schedule.findMany({
    where: { tripId },
    orderBy: [{ dayNo: 'asc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json(schedules)
}
