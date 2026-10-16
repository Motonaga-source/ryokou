import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { parseVehicleInput } from '@/lib/pickup'

// POST /api/pickup/vehicles  送迎車を追加（管理者のみ）
// body: { name: string, capacity: number, location: "yuzato" | "grace" | "uriwari-nishi" | "other" }
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const input = parseVehicleInput(await request.json())
  if (typeof input === 'string') {
    return NextResponse.json({ error: input }, { status: 400 })
  }

  const vehicle = await prisma.pickupVehicle.create({ data: input })
  return NextResponse.json(vehicle)
}
