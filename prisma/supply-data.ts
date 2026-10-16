// 持ち物リストの初期データ
// scripts/update-supplies.ts と prisma/seed.ts の両方から使用する
import { SUPPLY_CATEGORIES } from '../lib/supplies'

export const SUPPLY_DATA: { itemName: string; category: string }[] = [
  ...[
    'グローブ',
    '箱ティッシュ',
    '着替え',
    'キッチンバサミ',
    'オムツ',
    'パッド（小・大）',
    'パッド（フラット）',
    'ゴミ袋（小）',
  ].map(itemName => ({ itemName, category: SUPPLY_CATEGORIES.COMMON })),
  ...[
    '瓜西HS（担当：岡田）',
    '瓜西CH（担当：大平）',
    'グレイス（担当：片山）',
    'ドルチェ（担当：種村）',
  ].map(itemName => ({ itemName, category: SUPPLY_CATEGORIES.MEDICINE })),
]
