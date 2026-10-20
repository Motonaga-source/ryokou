// 昼食会場のテーブル（lib/lunch.ts の DEFAULT_LUNCH_TABLES）を登録する
// 既に登録済みのテーブルは上書きしないので、何度実行しても安全
// 実行: npm run db:seed-lunch-tables
import { PrismaClient } from '@prisma/client'
import { DEFAULT_LUNCH_TABLES } from '../lib/lunch'

const prisma = new PrismaClient()
const TRIP_ID = 1

async function main() {
  const { count } = await prisma.lunchTable.createMany({
    data: DEFAULT_LUNCH_TABLES.map(t => ({ tripId: TRIP_ID, ...t })),
    skipDuplicates: true,
  })
  const tables = await prisma.lunchTable.findMany({ where: { tripId: TRIP_ID }, orderBy: [{ layoutRow: 'asc' }, { layoutOrder: 'asc' }] })
  console.log(`✅ テーブル ${count}卓を新規登録（登録済み ${tables.length}卓・計${tables.reduce((n, t) => n + t.capacity, 0)}席・車椅子枠${tables.reduce((n, t) => n + t.wheelchairSlots, 0)}）`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
