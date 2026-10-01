export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const assignments = await prisma.busSeatAssignment.findMany({
    where: { tripId },
    include: { person: true },
  })
  
  // 参加者一覧も返す（未割り当ての人を表示するため）
  const persons = await prisma.person.findMany({
    where: { participations: { some: { tripId, status: '参加' } } },
    include: { 
      busAssignments: { where: { tripId } },
      carAssignments: { include: { car: true } }
    },
  })

  return NextResponse.json({ assignments, persons })
}

export async function PUT(request: Request) {
  const body = await request.json()
  // body: { tripId, personId, vehicle, rowNo, seatSide, seatType }
  
  const tripId = body.tripId || 1

  const assignment = await prisma.busSeatAssignment.upsert({
    where: {
      tripId_personId: {
        tripId,
        personId: body.personId,
      }
    },
    update: {
      vehicle: body.vehicle,
      rowNo: body.rowNo,
      seatSide: body.seatSide,
      seatType: body.seatType,
    },
    create: {
      tripId,
      personId: body.personId,
      vehicle: body.vehicle,
      rowNo: body.rowNo,
      seatSide: body.seatSide,
      seatType: body.seatType,
    },
  })
  
  // 排他制御: バスに乗ったので乗用車の割り当てを削除
  await prisma.carAssignment.deleteMany({
    where: { personId: body.personId }
  })

  return NextResponse.json(assignment)
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const personId = parseInt(searchParams.get('personId') || '0')
  const tripId = parseInt(searchParams.get('tripId') || '1')
  
  await prisma.busSeatAssignment.deleteMany({
    where: { tripId, personId }
  })
  
  return NextResponse.json({ success: true })
}
