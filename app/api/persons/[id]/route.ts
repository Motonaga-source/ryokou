import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTripId } from '@/lib/event'
import { isParticipationStatus, normalizeMemo } from '@/lib/participation'

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
      pocketMoneyRecords: true,
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
      isFishNG: body.isFishNG ?? undefined,
    },
  })

  // 参加ステータス・送迎メモは、選択中のイベントの参加レコードに保存する
  const status = isParticipationStatus(body.status) ? body.status : undefined
  const pickupMemo = normalizeMemo(body.pickupMemo)
  if (status !== undefined || pickupMemo !== undefined) {
    const tripId = await resolveTripId(request)
    await prisma.tripParticipation.upsert({
      where: { tripId_personId: { tripId, personId: person.id } },
      update: { status, pickupMemo },
      // 参加レコードがまだない人は、指定がなければ「不参加」で作る（編集しただけで参加にならないように）
      create: { tripId, personId: person.id, status: status ?? '不参加', pickupMemo: pickupMemo ?? null },
    })
  }

  return NextResponse.json(person)
}

// DELETE /api/persons/[id]
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const personId = parseInt(id)
    // 名簿は全イベント共通。削除するとその人の全イベントの記録も消えるため、
    // 終了したイベント（閲覧専用）に参加記録がある人は削除できないようにする
    const closed = await prisma.tripParticipation.findFirst({
      where: { personId, trip: { status: 'CLOSED' } },
      select: { trip: { select: { name: true } } },
    })
    if (closed) {
      return NextResponse.json(
        { error: `終了したイベント「${closed.trip.name}」の記録があるため削除できません。このイベントに参加しない場合は「参加者の登録」で不参加にしてください。` },
        { status: 409 }
      )
    }
    await prisma.person.delete({ where: { id: personId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete Error:', error)
    const message = error instanceof Error ? error.message : ''
    return NextResponse.json({ error: message || '削除に失敗しました。関連データを確認してください。' }, { status: 500 })
  }
}
