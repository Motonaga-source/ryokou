// マルチイベント対応 P2 のデータ移行（何度実行しても同じ結果になる）
// イベントごとに変わる項目を、Person から滋賀1泊旅行（Trip id=1）の参加レコード（TripParticipation）へコピーする
//   送迎メモ / 点呼済み / 車椅子の出所 / 小遣いの管理区分 / 小遣いの事後回収
// - Person 側の値は消さない（P2 以降のコードは Person 側を読み書きしないので、値は旅行終了時点のまま残る）
// - 滋賀1泊旅行は終了（閲覧専用）のため参加レコード側も変わらず、再実行しても同じ値になる
// - 参加レコードがない人（旅行に登録されていない人）にはレコードを作らない
// 実行: npm run dev-db -- npx ts-node scripts/migrate-p2-participation.ts   （開発用 DB）
//       npx ts-node scripts/migrate-p2-participation.ts                      （本番。検証後のみ）
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SHIGA_TRIP_ID = 1
const FIELDS = ['pickupMemo', 'isRollCalled', 'wheelchairSource', 'allowanceManagementType', 'allowanceRequiresCollection'] as const

async function main() {
  const participations = await prisma.tripParticipation.findMany({
    where: { tripId: SHIGA_TRIP_ID },
    include: { person: true },
    orderBy: { id: 'asc' },
  })

  let changed = 0
  for (const tp of participations) {
    const data = Object.fromEntries(FIELDS.map(f => [f, tp.person[f]]))
    if (FIELDS.every(f => tp[f] === tp.person[f])) continue
    await prisma.tripParticipation.update({ where: { id: tp.id }, data })
    changed++
  }

  // 確認: すべての参加レコードが Person の値と一致しているか
  const after = await prisma.tripParticipation.findMany({ where: { tripId: SHIGA_TRIP_ID }, include: { person: true } })
  const mismatch = after.filter(tp => FIELDS.some(f => tp[f] !== tp.person[f]))
  const count = (f: (typeof FIELDS)[number]) => after.filter(tp => tp[f] !== null && tp[f] !== false).length

  console.log(`イベント${SHIGA_TRIP_ID}の参加レコード ${participations.length}件のうち ${changed}件を更新`)
  console.log(
    `値が入っている件数: 送迎メモ ${count('pickupMemo')} / 点呼済み ${count('isRollCalled')} / 車椅子の出所 ${count('wheelchairSource')} / ` +
      `小遣いの管理区分 ${count('allowanceManagementType')} / 事後回収 ${count('allowanceRequiresCollection')}`
  )
  console.log(`Person と一致しない参加レコード: ${mismatch.length}件`)
  if (mismatch.length) process.exitCode = 1
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
