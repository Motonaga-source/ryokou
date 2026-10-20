// 小遣いの事前ルール（管理区分・事後回収の要否）の定義。API と「小遣い精算（編集）」画面で共通

export const ALLOWANCE_TYPES = [
  { value: 'STAFF', label: 'スタッフ管理', short: 'スタッフ', description: 'スタッフが預かって管理する', color: 'bg-blue-600 border-blue-600 text-white' },
  { value: 'USER', label: '本人管理', short: '本人', description: '法人で準備したお金を本人が持つ', color: 'bg-emerald-600 border-emerald-600 text-white' },
  { value: 'SELF', label: '自己管理', short: '自己', description: '本人が自分で用意（法人準備なし）', color: 'bg-amber-500 border-amber-500 text-white' },
] as const

export type AllowanceType = (typeof ALLOWANCE_TYPES)[number]['value']

export function isAllowanceType(value: unknown): value is AllowanceType {
  return ALLOWANCE_TYPES.some(t => t.value === value)
}

// 自己管理（法人準備なし）は法人のお金を渡さないため、事後回収の対象にならない
export const canRequireCollection = (type: string | null) => type !== 'SELF'

// 法人が小遣いを預かる（支給額を設定・精算する）対象か。自己管理（法人準備なし）は対象外
export const isCorporateAllowance = (type: string | null) => type !== 'SELF'

// 支給額・使用額として受け付ける上限（入力ミス防止）
export const MAX_ALLOWANCE_YEN = 1_000_000

export interface AllowanceRule {
  id: number
  name: string
  facility: string | null
  allowanceManagementType: string | null
  allowanceRequiresCollection: boolean
}
