export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'

export async function GET(request: Request) {
  const tripId = await resolveTripId(request)

  const teams = await prisma.team.findMany({
    where: { tripId },
    include: {
      members: {
        include: { person: true },
      },
    },
  })
  return NextResponse.json(teams)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, color } = body
  const tripId = await resolveTripId(request)

  const team = await prisma.team.create({
    data: {
      tripId,
      name,
      color: color || null,
    }
  })
  return NextResponse.json(team, { status: 201 })
}
