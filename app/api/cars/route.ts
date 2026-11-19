export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'

export async function GET(request: Request) {
  const tripId = await resolveTripId(request)

  const cars = await prisma.car.findMany({
    where: { tripId },
    include: {
      assignments: {
        include: { person: true }
      }
    }
  })
  
  return NextResponse.json(cars)
}

export async function POST(request: Request) {
  const body = await request.json()
  const car = await prisma.car.create({
    data: {
      tripId: await resolveTripId(request),
      name: body.name,
      capacity: body.capacity
    }
  })
  return NextResponse.json(car)
}
