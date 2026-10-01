export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const persons = await prisma.person.findMany({
    where: { 
      role: 'USER',
      participations: { some: { tripId, status: '参加' } } 
    },
    include: { medication: true },
  })
  
  const records = persons.map(person => {
    return {
      person: {
        id: person.id,
        name: person.name,
        facility: person.facility,
        gender: person.gender
      },
      medication: person.medication || {
        hasBreakfast: false, breakfastNote: null,
        hasLunch: false, lunchNote: null,
        hasDinner: false, dinnerNote: null,
        hasSleep: false, sleepNote: null,
        hasAsNeeded: false, asNeededNote: null
      }
    }
  })

  return NextResponse.json(records)
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    
    // 安全のため、idやcreatedAtなどの自動管理フィールドを除外
    const { id, personId, createdAt, updatedAt, ...safeData } = body.medication || {}
    
    const existing = await prisma.medication.findUnique({
      where: { personId: body.personId }
    })

    let record
    if (existing) {
      record = await prisma.medication.update({
        where: { personId: body.personId },
        data: safeData
      })
    } else {
      record = await prisma.medication.create({
        data: {
          personId: body.personId,
          ...safeData
        }
      })
    }
    
    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Medication PUT Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
