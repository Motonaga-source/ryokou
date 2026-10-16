// 持ち物チェックリストを初期データ（prisma/supply-data.ts）で入れ替える
// 実行: npm run db:update-supplies
import { PrismaClient } from '@prisma/client'
import { SUPPLY_DATA } from '../prisma/supply-data'

const prisma = new PrismaClient()
const TRIP_ID = 1

async function main() {
  const [deleted, created] = await prisma.$transaction([
    prisma.supplyItem.deleteMany({ where: { tripId: TRIP_ID } }),
    prisma.supplyItem.createMany({ data: SUPPLY_DATA.map(s => ({ tripId: TRIP_ID, ...s })) }),
  ])

  console.log(`🗑️  既存の持ち物 ${deleted.count}件を削除`)
  console.log(`✅ 持ち物 ${created.count}件を登録`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
