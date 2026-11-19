export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'

export async function GET(request: Request) {
  const tripId = await resolveTripId(request)
  const rooms = await prisma.room.findMany({
    where: { tripId },
    include: { assignments: { include: { person: { include: { medication: true } } } } },
    orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
  })
  return NextResponse.json(rooms)
}

export async function POST(request: Request) {
  const body = await request.json()
  const tripId = await resolveTripId(request)
  const { roomNumber, floor, capacity, roomType, notes } = body
  const room = await prisma.room.create({
    data: {
      tripId,
      roomNumber,
      floor: parseInt(floor),
      capacity: parseInt(capacity),
      roomType: roomType || 'Standard',
      notes: notes || '',
    }
  })
  return NextResponse.json(room, { status: 201 })
}
