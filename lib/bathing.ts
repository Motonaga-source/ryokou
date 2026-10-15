// 入浴管理の役割（グループ）定義。prisma/schema.prisma の BathingRole と同期させること
export const BATHING_ROLES = [
  {
    value: 'MAIN_BATH',
    label: '大浴場（介助入浴）',
    icon: '♨️',
    description: '大浴場に入浴する利用者と入浴介助スタッフ',
    colorClass: 'bg-sky-100 border-sky-400',
  },
  {
    value: 'DRESSING_SUPPORT',
    label: '脱衣所サポート',
    icon: '👕',
    description: '衣類の着脱・バイタル測定をするスタッフ',
    colorClass: 'bg-green-100 border-green-400',
  },
  {
    value: 'ESCORT',
    label: '送迎・誘導',
    icon: '🚶',
    description: '入浴前後のお部屋と浴場への送迎スタッフ',
    colorClass: 'bg-yellow-100 border-yellow-400',
  },
  {
    value: 'ROOM_BATH',
    label: '部屋風呂',
    icon: '🛁',
    description: 'お部屋のお風呂に入る利用者',
    colorClass: 'bg-purple-100 border-purple-400',
  },
  {
    value: 'INDEPENDENT',
    label: '自立入浴',
    icon: '🧼',
    description: '介助なしで入浴できる利用者',
    colorClass: 'bg-orange-100 border-orange-400',
  },
] as const

export type BathingRoleValue = (typeof BATHING_ROLES)[number]['value']

export function isBathingRole(value: unknown): value is BathingRoleValue {
  return BATHING_ROLES.some(r => r.value === value)
}

export interface BathingPerson {
  id: number
  name: string
  role: string
  gender: string | null
  isWheelchair?: boolean
  participations?: { status: string }[]
}

// 並び順: スタッフ → 車椅子 → 一般（teams / rooms と同じロジック）
export function sortPersons<T extends BathingPerson>(persons: T[]): T[] {
  return [...persons].sort((a, b) => {
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
  assignments: { personId: number; role: string | null }[],
): { groups: BathingBoard; unassigned: BathingPerson[] } {
  const roleByPerson = new Map(assignments.map(a => [a.personId, a.role]))
  const groups = Object.fromEntries(BATHING_ROLES.map(r => [r.value, []])) as unknown as BathingBoard
  const unassigned: BathingPerson[] = []

  for (const p of persons) {
    if (p.participations?.[0]?.status !== '参加') continue
    const role = roleByPerson.get(p.id)
    if (isBathingRole(role)) groups[role].push(p)
    else unassigned.push(p)
  }

  for (const r of BATHING_ROLES) groups[r.value] = sortPersons(groups[r.value])
  return { groups, unassigned: sortPersons(unassigned) }
}
