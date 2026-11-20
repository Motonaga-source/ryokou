export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { isParticipationStatus, normalizeMemo, withEventFields } from '@/lib/participation'

// GET /api/persons
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const tripId = await resolveTripId(request)

  const persons = await prisma.person.findMany({
    where: {
      ...(role && role !== '全て' ? { role } : {}),
    },
    include: {
      medication: true,
      participations: { where: { tripId } }, // 選択中のイベントの参加状況だけ
      roomAssignments: {
        where: { room: { tripId } },
        include: { room: true },
      },
      vitalRecords: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  })
  // 送迎メモなどイベントごとの項目は、選択中のイベントの参加レコードの値を同じ名前で返す
  return NextResponse.json(persons.map(withEventFields))
}

// POST /api/persons
export async function POST(request: Request) {
  const body = await request.json()
  const { status, ...personData } = body
  const tripId = await resolveTripId(request)
  
  const person = await prisma.person.create({ 
    data: {
      name: personData.name,
      gender: personData.gender,
      role: personData.role,
      facility: personData.facility,
      notes: personData.notes,
      isWheelchair: personData.isWheelchair || false,
      isFishNG: personData.isFishNG || false,
    } 
  })

  // 選択中のイベントの参加レコードを作る（送迎メモはイベントごとの項目）
  await prisma.tripParticipation.create({
    data: {
      personId: person.id,
      tripId,
      status: isParticipationStatus(status) ? status : '参加',
      pickupMemo: normalizeMemo(personData.pickupMemo) ?? null,
    }
  })

  return NextResponse.json(person, { status: 201 })
}
