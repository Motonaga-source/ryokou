import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isPickupVehicleId } from '@/lib/pickup'

// PUT /api/pickup/vehicles/:id  送迎車の名称と定員を更新（管理者のみ）
// body: { name: string, capacity: number }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  const vehicleId = parseInt(id)
  if (!isPickupVehicleId(vehicleId)) {
    return NextResponse.json({ error: '送迎車が見つかりません' }, { status: 404 })
  }

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const capacity = Number(body.capacity)
  if (!name) {
    return NextResponse.json({ error: '車両名を入力してください' }, { status: 400 })
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 99) {
    return NextResponse.json({ error: '定員は1〜99の整数で入力してください' }, { status: 400 })
  }

  const vehicle = await prisma.pickupVehicle.upsert({
    where: { id: vehicleId },
    create: { id: vehicleId, name, capacity },
    update: { name, capacity },
  })
  return NextResponse.json(vehicle)
}
