export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const assignments = await prisma.bathingAssignment.findMany({
    where: { tripId },
    include: { person: true },
  })
  return NextResponse.json(assignments)
}
