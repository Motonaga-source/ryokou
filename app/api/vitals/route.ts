export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const rooms = await prisma.room.findMany({
    where: { tripId },
    include: {
      assignments: {
        include: {
          person: {
            include: {
              medication: true,
              vitalRecords: {
                orderBy: { recordedAt: 'desc' },
                take: 1
              }
            }
          }
        }
      }
    }
  })

  return NextResponse.json(rooms)
}

export async function POST(request: Request) {
  const body = await request.json()
  const vital = await prisma.vitalRecord.create({
    data: {
      personId: body.personId,
      roomId: body.roomId,
      bloodPressureHigh: body.bloodPressureHigh ? parseInt(body.bloodPressureHigh) : null,
      bloodPressureLow: body.bloodPressureLow ? parseInt(body.bloodPressureLow) : null,
      pulse: body.pulse ? parseInt(body.pulse) : null,
      temperature: body.temperature ? parseFloat(body.temperature) : null,
      notes: body.notes
    }
  })
  return NextResponse.json(vital)
}
