// 入浴管理の役割（グループ）定義。prisma/schema.prisma の BathingRole と同期させること
export const BATHING_ROLES = [
  {
    value: 'MAIN_BATH_MALE',
    label: '大浴場（男湯）',
    baseLabel: '大浴場',
    bath: 'MALE',
    icon: '♨️',
    description: '大浴場に入浴する利用者と入浴介助スタッフ',
    colorClass: 'bg-sky-100 border-sky-400',
  },
  {
    value: 'MAIN_BATH_FEMALE',
    label: '大浴場（女湯）',
    baseLabel: '大浴場',
    bath: 'FEMALE',
    icon: '♨️',
    description: '大浴場に入浴する利用者と入浴介助スタッフ',
    colorClass: 'bg-sky-100 border-sky-400',
  },
  {
    value: 'DRESSING_SUPPORT_MALE',
    label: '脱衣所サポート（男湯）',
    baseLabel: '脱衣所サポート',
    bath: 'MALE',
    icon: '👕',
    description: '衣類の着脱・バイタル測定をするスタッフ',
    colorClass: 'bg-green-100 border-green-400',
  },
  {
    value: 'DRESSING_SUPPORT_FEMALE',
    label: '脱衣所サポート（女湯）',
    baseLabel: '脱衣所サポート',
    bath: 'FEMALE',
    icon: '👕',
    description: '衣類の着脱・バイタル測定をするスタッフ',
    colorClass: 'bg-green-100 border-green-400',
  },
  {
    value: 'ESCORT_MALE',
    label: '送迎・誘導（男湯）',
    baseLabel: '送迎・誘導',
    bath: 'MALE',
    icon: '🚶',
    description: '入浴前後のお部屋と浴場への送迎スタッフ',
    colorClass: 'bg-yellow-100 border-yellow-400',
  },
  {
    value: 'ESCORT_FEMALE',
    label: '送迎・誘導（女湯）',
    baseLabel: '送迎・誘導',
    bath: 'FEMALE',
    icon: '🚶',
    description: '入浴前後のお部屋と浴場への送迎スタッフ',
    colorClass: 'bg-yellow-100 border-yellow-400',
  },
  {
    value: 'ROOM_BATH',
    label: '部屋風呂',
    baseLabel: '部屋風呂',
    bath: null,
    icon: '🛁',
    description: 'お部屋のお風呂に入る利用者',
    colorClass: 'bg-purple-100 border-purple-400',
  },
  {
    value: 'INDEPENDENT',
    label: '自立入浴',
    baseLabel: '自立入浴',
    bath: null,
    icon: '🧼',
    description: '介助なしで入浴できる利用者',
    colorClass: 'bg-orange-100 border-orange-400',
  },
] as const

export type BathingRoleDef = (typeof BATHING_ROLES)[number]

// 男湯・女湯の区別バッジ（男女別でない役割は null）
export const BATH_BADGES = {
  MALE: { label: '男湯', className: 'bg-blue-600 text-white' },
  FEMALE: { label: '女湯', className: 'bg-rose-500 text-white' },
} as const

export type BathingRoleValue = (typeof BATHING_ROLES)[number]['value']

export function isBathingRole(value: unknown): value is BathingRoleValue {
  return BATHING_ROLES.some(r => r.value === value)
}

// 入浴の班（大浴場などに一度に全員を案内できないため分ける）
export const BAN_NUMBERS = [1, 2, 3] as const
export type BanNumber = (typeof BAN_NUMBERS)[number]

export function isBanNumber(value: unknown): value is BanNumber {
  return BAN_NUMBERS.some(n => n === value)
}

export interface BathingPerson {
  id: number
  name: string
  role: string
  gender: string | null
  isWheelchair?: boolean
  banNumber?: number | null
  participations?: { status: string }[]
}

// 並び順: 班（1班 → 2班 → 3班 → 未設定）→ スタッフ → 車椅子 → 一般
export function sortPersons<T extends BathingPerson>(persons: T[]): T[] {
  return [...persons].sort((a, b) => {
    const aBan = a.banNumber ?? Infinity
    const bBan = b.banNumber ?? Infinity
    if (aBan !== bBan) return aBan - bBan
    const aStaff = a.role === 'STAFF' ? 1 : 0
    const bStaff = b.role === 'STAFF' ? 1 : 0
    if (aStaff !== bStaff) return bStaff - aStaff
    const aWheel = a.isWheelchair ? 1 : 0
    const bWheel = b.isWheelchair ? 1 : 0
    if (aWheel !== bWheel) return bWheel - aWheel
    return a.id - b.id
  })
}

export type BathingBoard = Record<BathingRoleValue, BathingPerson[]>

// 参加者一覧と割り当て一覧から、役割ごとの人員と未割り当て人員を組み立てる
export function buildBathingBoard(
  persons: BathingPerson[],
  assignments: { personId: number; role: string | null; banNumber?: number | null }[],
): { groups: BathingBoard; unassigned: BathingPerson[] } {
  const assignmentByPerson = new Map(assignments.map(a => [a.personId, a]))
  const groups = Object.fromEntries(BATHING_ROLES.map(r => [r.value, []])) as unknown as BathingBoard
  const unassigned: BathingPerson[] = []

  for (const p of persons) {
    if (p.participations?.[0]?.status !== '参加') continue
    const assignment = assignmentByPerson.get(p.id)
    const role = assignment?.role
    if (isBathingRole(role)) groups[role].push({ ...p, banNumber: assignment?.banNumber ?? null })
    else unassigned.push({ ...p, banNumber: null })
  }

  for (const r of BATHING_ROLES) groups[r.value] = sortPersons(groups[r.value])
  return { groups, unassigned: sortPersons(unassigned) }
}
