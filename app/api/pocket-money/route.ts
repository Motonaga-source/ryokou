export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  // 参加ステータスが「参加」の利用者を全て取得
  const persons = await prisma.person.findMany({
    where: { 
      role: 'USER',
      participations: { some: { tripId, status: '参加' } } 
    },
    include: { pocketMoneyRecord: true },
  })

  let totalAllocated = 0
  let totalUsed = 0

  const records = persons.map(person => {
    // 既存のレコードがなければデフォルト値（5000円など）とする
    const rec = person.pocketMoneyRecord || {
      id: -person.id, // 仮のID
      allocated: 5000,
      used: 0,
      remaining: 5000
    }
    totalAllocated += rec.allocated
    totalUsed += rec.used

    return {
      id: rec.id,
      allocated: rec.allocated,
      used: rec.used,
      remaining: rec.remaining,
      person: {
        id: person.id,
        name: person.name,
        gender: person.gender,
        facility: person.facility
      }
    }
  })

  return NextResponse.json({
    records,
    total: {
      allocated: totalAllocated,
      used: totalUsed,
      remaining: totalAllocated - totalUsed
    }
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  const record = await prisma.pocketMoneyRecord.create({
    data: {
      tripId: body.tripId || 1,
      personId: body.personId,
      allocated: body.allocated,
      used: body.used || 0,
      remaining: body.allocated - (body.used || 0)
    }
  })
  return NextResponse.json(record)
}
