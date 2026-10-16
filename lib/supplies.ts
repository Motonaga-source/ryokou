// 持ち物リストの定義（API・画面・シードで共通）

export const SUPPLY_CATEGORIES = {
  COMMON: '共通備品',
  MEDICINE: '施設別の薬',
} as const

export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[keyof typeof SUPPLY_CATEGORIES]

export function isSupplyCategory(value: unknown): value is SupplyCategory {
  return Object.values(SUPPLY_CATEGORIES).some(c => c === value)
}

// 車椅子の出所（"グレイス貸出" の人数が貸出用車椅子の必要台数になる）
export const WHEELCHAIR_SOURCES = ['グレイス貸出', '持参'] as const
export const WHEELCHAIR_LOAN = WHEELCHAIR_SOURCES[0]

export function isWheelchairSource(value: unknown): value is (typeof WHEELCHAIR_SOURCES)[number] {
  return WHEELCHAIR_SOURCES.some(s => s === value)
}

export interface SupplyItem {
  id: number
  itemName: string
  category: string | null
}

export interface WheelchairPerson {
  id: number
  name: string
  isWheelchair: boolean
  wheelchairSource: string | null
}

export interface SuppliesResponse {
  items: SupplyItem[]
  // 参加者のうち車椅子利用者、または車椅子の出所が設定されている人
  wheelchairs: WheelchairPerson[]
}
