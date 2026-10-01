import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT /api/rooms/[id]/assign  - 部屋割り変更
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  // body: { personId, action: 'add' | 'remove' }

  if (body.action === 'add') {
    // 既存の部屋割りを削除してから新しい部屋に追加
    await prisma.roomAssignment.deleteMany({
      where: { personId: body.personId },
    })
    const assignment = await prisma.roomAssignment.create({
      data: {
        roomId: parseInt(id),
        personId: body.personId,
        isStaff: body.isStaff ?? false,
      },
      include: { person: true, room: true },
    })
    return NextResponse.json(assignment)
  } else if (body.action === 'remove') {
    await prisma.roomAssignment.deleteMany({
      where: { roomId: parseInt(id), personId: body.personId },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
