// 旅行スケジュールを本番用データ（prisma/schedule-data.ts）で入れ替える
// 実行: npm run db:update-schedule
import { PrismaClient } from '@prisma/client'
import { withSortOrder } from '../prisma/schedule-data'

const prisma = new PrismaClient()
const TRIP_ID = 1

async function main() {
  const rows = withSortOrder().map(s => ({ tripId: TRIP_ID, ...s }))

  const [deleted, created] = await prisma.$transaction([
    prisma.schedule.deleteMany({ where: { tripId: TRIP_ID } }),
    prisma.schedule.createMany({ data: rows }),
  ])

  console.log(`🗑️  既存スケジュール ${deleted.count}件を削除`)
  console.log(`✅ スケジュール ${created.count}件を登録`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
