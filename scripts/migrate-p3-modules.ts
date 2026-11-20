// マルチイベント対応 P3 のデータ移行（何度実行しても同じ結果になる）
// - 滋賀1泊旅行（Trip id=1）で使う機能を「すべて ON」にする（機能が未設定のときだけ）
// - これまでダッシュボードに直接書いていた「重要な注意事項」を、旅行の注意事項として保存する（未設定のときだけ）
// 実行: npm run dev-db -- npx ts-node scripts/migrate-p3-modules.ts   （開発用 DB）
//       npx ts-node scripts/migrate-p3-modules.ts                      （本番。検証後のみ）
import { PrismaClient } from '@prisma/client'
import { ALL_MODULE_KEYS } from '../lib/modules'

const prisma = new PrismaClient()
const SHIGA_TRIP_ID = 1

// P2 までダッシュボード（app/page.tsx・app/admin/page.tsx）に直接書かれていた内容と同じ
const SHIGA_DASHBOARD_NOTES = [
  '🚫 **アルコール提供NG**：玉井様、仲様',
  '💊 **眠前薬注意**：アルコールを飲まれる方の眠前薬は中止',
  '🚢 **船苦手な方**：菅原様・山内様（松本さんが対応）',
  '🏨 **夜間外出禁止**：ホテルの外に出るのは禁止',
].join('\n')

async function main() {
  const trip = await prisma.trip.findUnique({ where: { id: SHIGA_TRIP_ID } })
  if (!trip) throw new Error(`Trip id=${SHIGA_TRIP_ID} が見つかりません`)

  const data: { modules?: string[]; dashboardNotes?: string } = {}
  if (trip.modules.length === 0) data.modules = ALL_MODULE_KEYS
  if (trip.dashboardNotes === null) data.dashboardNotes = SHIGA_DASHBOARD_NOTES
  // 終了したイベントの updatedAt を動かさないよう、変更がないときは更新しない
  const after = Object.keys(data).length ? await prisma.trip.update({ where: { id: SHIGA_TRIP_ID }, data }) : trip

  console.log(`イベント${SHIGA_TRIP_ID}（${after.name}）: ${Object.keys(data).length ? `${Object.keys(data).join('・')} を設定` : '変更なし'}`)
  console.log(`  使う機能 ${after.modules.length}/${ALL_MODULE_KEYS.length}: ${after.modules.join(', ')}`)
  console.log(`  注意事項 ${after.dashboardNotes?.split('\n').length ?? 0}行`)
  const missing = ALL_MODULE_KEYS.filter(k => !after.modules.includes(k))
  if (missing.length) console.log(`  （OFF の機能: ${missing.join(', ')}）`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
