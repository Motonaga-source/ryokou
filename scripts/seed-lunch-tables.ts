// 昼食会場のテーブルを lib/lunch.ts の DEFAULT_LUNCH_TABLES に合わせて登録・更新する
// 未登録のテーブルは追加し、登録済みのテーブルは定員・車椅子枠・配置位置を定義どおりに更新する（座席の割り当ては消さない）
// 実行: npm run db:seed-lunch-tables
import { PrismaClient } from '@prisma/client'
import { DEFAULT_LUNCH_TABLES } from '../lib/lunch'

const prisma = new PrismaClient()
const TRIP_ID = 1

async function main() {
  for (const t of DEFAULT_LUNCH_TABLES) {
    const { tableNo, ...rest } = t
    await prisma.lunchTable.upsert({
      where: { tripId_tableNo: { tripId: TRIP_ID, tableNo } },
      create: { tripId: TRIP_ID, ...t },
      update: rest,
    })
  }
  const tables = await prisma.lunchTable.findMany({ where: { tripId: TRIP_ID }, orderBy: [{ layoutRow: 'asc' }, { layoutOrder: 'asc' }] })
  console.log(`✅ テーブル ${tables.length}卓（計${tables.reduce((n, t) => n + t.capacity, 0)}席・車椅子枠${tables.reduce((n, t) => n + t.wheelchairSlots, 0)}）`)
  console.log(tables.map(t => `T${t.tableNo}: 定員${t.capacity}・♿${t.wheelchairSlots}`).join(' / '))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
