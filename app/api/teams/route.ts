export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

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
  const { tripId, name, color } = body

  const team = await prisma.team.create({
    data: {
      tripId: tripId || 1,
      name,
      color: color || null,
    }
  })
  return NextResponse.json(team, { status: 201 })
}
