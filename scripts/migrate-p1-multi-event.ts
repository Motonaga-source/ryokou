// マルチイベント対応 P1 のデータ移行（何度実行しても同じ結果になる）
// - 送迎車（PickupVehicle）でイベント未設定のものを、滋賀1泊旅行（Trip id=1）に割り当てる
// - 滋賀1泊旅行を「終了（CLOSED）」にして閲覧専用にする
// 実行: npm run dev-db -- npx ts-node scripts/migrate-p1-multi-event.ts   （開発用 DB）
//       npx ts-node scripts/migrate-p1-multi-event.ts                      （本番。検証後のみ）
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SHIGA_TRIP_ID = 1

async function main() {
  const trip = await prisma.trip.findUnique({ where: { id: SHIGA_TRIP_ID } })
  if (!trip) throw new Error(`Trip id=${SHIGA_TRIP_ID} が見つかりません`)

  const vehicles = await prisma.pickupVehicle.updateMany({
    where: { tripId: null },
    data: { tripId: SHIGA_TRIP_ID },
  })
  const closed = await prisma.trip.update({
    where: { id: SHIGA_TRIP_ID },
    data: { status: 'CLOSED' },
  })

  console.log(`送迎車: ${vehicles.count}台をイベント${SHIGA_TRIP_ID}（${trip.name}）に割り当て`)
  console.log(`イベント${SHIGA_TRIP_ID}（${closed.name}）: status=${closed.status}`)
  console.log(`未割り当ての送迎車: ${await prisma.pickupVehicle.count({ where: { tripId: null } })}台`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
