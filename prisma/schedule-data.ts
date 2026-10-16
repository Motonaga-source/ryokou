// 本番用の旅行スケジュール（2026/10/29〜10/30）
// scripts/update-schedule.ts と prisma/seed.ts の両方から使用する

export interface ScheduleSeed {
  dayNo: number
  timeLabel: string
  location: string
  description?: string
}

const day1: Omit<ScheduleSeed, 'dayNo'>[] = [
  { timeLabel: '08:00', location: '集合・バイタル測定・乗車開始（各配車場所にて）' },
  { timeLabel: '08:30', location: '① 東住吉区長居公園通り付近 出発' },
  { timeLabel: '09:00', location: '② 平野区第二めぐむ保育園付近 出発' },
  { timeLabel: '09:40', location: '③ 平野区ひごペット瓜破店付近 出発' },
  { timeLabel: '10:30', location: 'トイレ休憩（高速PAなど）' },
  { timeLabel: '11:20', location: '淡味の膳処 洗心寮 着' },
  { timeLabel: '11:30', location: '昼食' },
  { timeLabel: '12:15', location: '💊 昼食後服薬' },
  { timeLabel: '12:30', location: '洗心寮 発' },
  { timeLabel: '13:00', location: '滋賀県立琵琶湖博物館 着', description: '📸 【集合写真撮影①：博物館前】' },
  { timeLabel: '13:15', location: '博物館 ご見学（班別行動）' },
  { timeLabel: '15:00', location: '琵琶湖博物館 発' },
  { timeLabel: '15:30', location: '雄琴温泉・びわこ緑水亭 着（チェックイン・各お部屋へ）' },
  { timeLabel: '16:00', location: '♨️ ご入浴（班ごとに順次誘導）' },
  { timeLabel: '17:45', location: '宴会場へ移動' },
  { timeLabel: '18:00', location: 'ご宴会開始（夕食）' },
  { timeLabel: '19:30', location: '💊 夕食後服薬' },
  { timeLabel: '20:00', location: 'ご宴会終了・各お部屋へ移動' },
  { timeLabel: '21:00', location: '就寝前バイタル測定・💊 就寝前服薬' },
  { timeLabel: '21:30', location: '消灯・夜間見回り' },
]

const day2: Omit<ScheduleSeed, 'dayNo'>[] = [
  { timeLabel: '06:00', location: '起床・モーニングケア（♨️ 希望者は朝風呂）' },
  { timeLabel: '07:30', location: '朝食（レストランバイキング）' },
  { timeLabel: '08:30', location: '💊 朝食後服薬' },
  { timeLabel: '09:30', location: 'お忘れ物チェック・乗車' },
  { timeLabel: '10:00', location: 'びわこ緑水亭 発' },
  { timeLabel: '11:30', location: '伊賀の里もくもく手づくりファーム 着', description: '📸 【集合写真撮影②：ファーム入場口付近】' },
  { timeLabel: '11:45', location: 'ファーム内ご見学・散策' },
  { timeLabel: '13:00', location: 'ご昼食（焼肉食べ放題）' },
  { timeLabel: '14:00', location: '💊 昼食後服薬' },
  { timeLabel: '14:30', location: '伊賀の里もくもく手づくりファーム 発' },
  { timeLabel: '15:20', location: 'トイレ休憩（高速PAなど）' },
  { timeLabel: '16:10', location: '①②③ 順次到着・解散' },
]

export const SCHEDULE_DATA: ScheduleSeed[] = [
  ...day1.map(s => ({ dayNo: 1, ...s })),
  ...day2.map(s => ({ dayNo: 2, ...s })),
]

// dayNo ごとに 1 から振った sortOrder を付けて返す
export function withSortOrder(data: ScheduleSeed[] = SCHEDULE_DATA) {
  const counters = new Map<number, number>()
  return data.map(s => {
    const sortOrder = (counters.get(s.dayNo) ?? 0) + 1
    counters.set(s.dayNo, sortOrder)
    return { ...s, sortOrder }
  })
}
