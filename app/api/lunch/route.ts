export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { LunchResponse } from '@/lib/lunch'

// GET /api/lunch?tripId=1  昼食会場のテーブルと割り当て一覧
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tripId = parseInt(searchParams.get('tripId') || '1')

  const [tables, assignments] = await Promise.all([
    prisma.lunchTable.findMany({
      where: { tripId },
      select: { id: true, tableNo: true, capacity: true, wheelchairSlots: true, layoutRow: true, layoutOrder: true },
      orderBy: [{ layoutRow: 'asc' }, { layoutOrder: 'asc' }],
    }),
    prisma.lunchSeatAssignment.findMany({ where: { tripId }, select: { personId: true, tableId: true, seatIndex: true } }),
  ])

  const body: LunchResponse = { tables, assignments }
  return NextResponse.json(body)
}
