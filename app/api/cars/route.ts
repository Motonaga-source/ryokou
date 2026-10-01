export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

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
      tripId: body.tripId || 1,
      name: body.name,
      capacity: body.capacity
    }
  })
  return NextResponse.json(car)
}
