export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/persons
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const tripId = searchParams.get('tripId')

  const persons = await prisma.person.findMany({
    where: {
      ...(role && role !== '全て' ? { role } : {}),
    },
    include: {
      medication: true,
      participations: tripId
        ? { where: { tripId: parseInt(tripId) } }
        : true,
      roomAssignments: {
        include: { room: true },
      },
      vitalRecords: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(persons)
}

// POST /api/persons
export async function POST(request: Request) {
  const body = await request.json()
  const { status, tripId, ...personData } = body
  
  const person = await prisma.person.create({ 
    data: {
      name: personData.name,
      gender: personData.gender,
      role: personData.role,
      facility: personData.facility,
      notes: personData.notes,
      isWheelchair: personData.isWheelchair || false,
    } 
  })

  // デフォルト参加処理
  const initialStatus = status || '参加'
  
  await prisma.tripParticipation.create({
    data: {
      personId: person.id,
      tripId: tripId || 1,
      status: initialStatus
    }
  })

  return NextResponse.json(person, { status: 201 })
}
