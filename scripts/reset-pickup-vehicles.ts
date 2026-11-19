// 送迎車をリセットし、各乗車拠点に1台ずつ初期の送迎車を登録する（送迎車への割り当ては解除される）
// 実行: npm run db:reset-pickup-vehicles -- <イベントID>   （省略時は 1 = 滋賀1泊旅行）
// 指定したイベントの送迎車だけを対象にする（他のイベントの送迎車には触らない）
import { PrismaClient } from '@prisma/client'
import { DEFAULT_PICKUP_VEHICLES } from '../lib/pickup'

const prisma = new PrismaClient()

async function main() {
  const tripId = Number(process.argv[2] ?? 1)
  if (!Number.isInteger(tripId) || tripId <= 0) throw new Error('イベントID が不正です')
  const [unassigned, deleted, created] = await prisma.$transaction([
    prisma.pickupAssignment.deleteMany({ where: { tripId, groupId: { startsWith: 'car-' } } }),
    prisma.pickupVehicle.deleteMany({ where: { tripId } }),
    prisma.pickupVehicle.createMany({ data: DEFAULT_PICKUP_VEHICLES.map(v => ({ ...v, tripId })) }),
  ])

  console.log(`イベント${tripId}: 🗑️  送迎車 ${deleted.count}台を削除（送迎車への割り当て ${unassigned.count}件を解除）`)
  console.log(`✅ 送迎車 ${created.count}台を登録`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
