import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { parseVehicleInput, vehicleGroupId } from '@/lib/pickup'

// PUT /api/pickup/vehicles/:id  送迎車の名称・定員・所属拠点を更新（管理者のみ）
// body: { name: string, capacity: number, location: "yuzato" | "grace" | "uriwari-nishi" | "other" }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  const input = parseVehicleInput(await request.json())
  if (typeof input === 'string') {
    return NextResponse.json({ error: input }, { status: 400 })
  }

  const { count } = await prisma.pickupVehicle.updateMany({ where: { id: parseInt(id) }, data: input })
  if (count === 0) return NextResponse.json({ error: '送迎車が見つかりません' }, { status: 404 })
  return NextResponse.json({ success: true })
}

// DELETE /api/pickup/vehicles/:id  送迎車を削除（管理者のみ）。乗車予定だった人は未割り当てに戻る
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  const vehicleId = parseInt(id)
  await prisma.$transaction([
    prisma.pickupAssignment.deleteMany({ where: { groupId: vehicleGroupId(vehicleId) } }),
    prisma.pickupVehicle.deleteMany({ where: { id: vehicleId } }),
  ])
  return NextResponse.json({ success: true })
}
