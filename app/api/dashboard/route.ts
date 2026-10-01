export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const trip = await prisma.trip.findUnique({
    where: { id: tripId }
  }) || {
    name: '滋賀への一泊旅行',
    destination: '滋賀',
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    travelFee: 26000,
    pocketMoney: 11000
  }

  const participations = await prisma.tripParticipation.findMany({
    where: { tripId, status: '参加' },
    include: { person: true }
  })

  const totalParticipants = participations.length
  const totalStaff = participations.filter(p => p.person.role === 'STAFF').length
  const totalUsers = participations.filter(p => p.person.role === 'USER').length

  const rooms = await prisma.room.count({
    where: { tripId }
  })

  // バイタルチェックは「参加」ステータスの人のうち、
  // 最新のバイタル記録が存在するかどうかで判定
  const personIds = participations.map(p => p.personId)
  
  const vitals = await prisma.vitalRecord.findMany({
    where: { personId: { in: personIds } },
    orderBy: { recordedAt: 'desc' }
  })
  
  // 各personIdにつき、記録があるかどうか
  const recordedPersonIds = new Set(vitals.map(v => v.personId))

  return NextResponse.json({
    trip,
    stats: {
      totalParticipants,
      totalStaff,
      totalUsers,
      vitalsDone: recordedPersonIds.size,
      vitalsTotal: totalParticipants,
      rooms
    }
  })
}
