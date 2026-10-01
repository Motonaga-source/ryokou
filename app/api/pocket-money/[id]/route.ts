import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsedId = parseInt(id)

    if (parsedId < 0) {
      const record = await prisma.pocketMoneyRecord.create({
        data: {
          tripId: 1, // 暫定で1固定
          personId: body.personId,
          allocated: body.allocated,
          used: body.used,
          remaining: body.allocated - body.used,
        }
      })
      return NextResponse.json(record)
    } else {
      const record = await prisma.pocketMoneyRecord.update({
        where: { id: parsedId },
        data: {
          used: body.used,
          remaining: body.allocated - body.used,
        },
      })
      return NextResponse.json(record)
    }
  } catch (error: any) {
    console.error('PocketMoney Update Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
