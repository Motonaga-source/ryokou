import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/persons/[id]
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const person = await prisma.person.findUnique({
    where: { id: parseInt(id) },
    include: {
      medication: true,
      participations: { include: { trip: true } },
      roomAssignments: { include: { room: true } },
      vitalRecords: { orderBy: { recordedAt: 'desc' } },
      bathingAssignments: true,
      pocketMoneyRecord: true,
    },
  })
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(person)
}

// PUT /api/persons/[id]
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const person = await prisma.person.update({
    where: { id: parseInt(id) },
    data: {
      name: body.name,
      nameKana: body.nameKana,
      gender: body.gender,
      facility: body.facility,
      notes: body.notes,
      isWheelchair: body.isWheelchair ?? undefined,
    },
  })

  // 参加ステータスの更新があれば処理（tripId=1固定とする）
  if (body.status) {
    await prisma.tripParticipation.upsert({
      where: {
        tripId_personId: {
          tripId: 1,
          personId: parseInt(id)
        }
      },
      update: { status: body.status },
      create: {
        tripId: 1,
        personId: parseInt(id),
        status: body.status
      }
    })
  }

  return NextResponse.json(person)
}

// DELETE /api/persons/[id]
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.person.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete Error:', error)
    return NextResponse.json({ error: error.message || '削除に失敗しました。関連データを確認してください。' }, { status: 500 })
  }
}
