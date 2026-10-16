// 送迎車をリセットし、各乗車拠点に1台ずつ初期の送迎車を登録する（送迎車への割り当ては解除される）
// 実行: npm run db:reset-pickup-vehicles
import { PrismaClient } from '@prisma/client'
import { DEFAULT_PICKUP_VEHICLES } from '../lib/pickup'

const prisma = new PrismaClient()

async function main() {
  const [unassigned, deleted, created] = await prisma.$transaction([
    prisma.pickupAssignment.deleteMany({ where: { groupId: { startsWith: 'car-' } } }),
    prisma.pickupVehicle.deleteMany({}),
    prisma.pickupVehicle.createMany({ data: DEFAULT_PICKUP_VEHICLES }),
  ])

  console.log(`🗑️  送迎車 ${deleted.count}台を削除（送迎車への割り当て ${unassigned.count}件を解除）`)
  console.log(`✅ 送迎車 ${created.count}台を登録`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
