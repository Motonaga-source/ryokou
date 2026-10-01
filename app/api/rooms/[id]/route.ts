import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT /api/rooms/[id]
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { roomNumber, floor, capacity, roomType, notes } = body

  const room = await prisma.room.update({
    where: { id: parseInt(id) },
    data: {
      roomNumber,
      floor: parseInt(floor),
      capacity: parseInt(capacity),
      roomType: roomType || '標準',
      notes: notes || '',
    }
  })
  return NextResponse.json(room)
}

// DELETE /api/rooms/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.room.delete({
      where: { id: parseInt(id) }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
