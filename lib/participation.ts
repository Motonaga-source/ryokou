// イベントごとの参加（TripParticipation）にまつわる共通処理（サーバー・画面の両方から使う。DB には触らない）
// 本人の基本属性（車椅子利用・魚料理NG など）は Person、イベントごとに変わる項目は TripParticipation に持つ

export const PARTICIPATION_STATUSES = ['参加', '不参加', '保留'] as const
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number]
export const isParticipationStatus = (v: unknown): v is ParticipationStatus =>
  PARTICIPATION_STATUSES.some(s => s === v)

// 参加者の登録画面（/admin/participation）の1行
export interface ParticipationRow {
  id: number
  name: string
  role: string
  gender: string | null
  facility: string | null
  isWheelchair: boolean
  isFishNG: boolean
  status: string | null // このイベントの参加状況。未登録なら null
}

// イベントごとに変わる項目（以前は Person にあった）
export interface EventFields {
  pickupMemo: string | null
  isRollCalled: boolean
  wheelchairSource: string | null
  allowanceManagementType: string | null
  allowanceRequiresCollection: boolean
}

// Prisma の select / include でそのまま使える、イベント固有項目の選択
export const EVENT_FIELDS_SELECT = {
  pickupMemo: true,
  isRollCalled: true,
  wheelchairSource: true,
  allowanceManagementType: true,
  allowanceRequiresCollection: true,
} as const

const EMPTY: EventFields = {
  pickupMemo: null,
  isRollCalled: false,
  wheelchairSource: null,
  allowanceManagementType: null,
  allowanceRequiresCollection: false,
}

// 参加レコード（なければ未設定）のイベント固有項目を取り出す
export function eventFieldsOf(tp: Partial<EventFields> | null | undefined): EventFields {
  if (!tp) return { ...EMPTY }
  return {
    pickupMemo: tp.pickupMemo ?? null,
    isRollCalled: tp.isRollCalled ?? false,
    wheelchairSource: tp.wheelchairSource ?? null,
    allowanceManagementType: tp.allowanceManagementType ?? null,
    allowanceRequiresCollection: tp.allowanceRequiresCollection ?? false,
  }
}

// 人の情報に、選択中のイベントのイベント固有項目を同じ名前で重ねる（画面側はこれまでと同じ名前で読める）
// participations は選択中のイベントで絞り込んだもの（0件 or 1件）を渡す
export function withEventFields<T extends { participations: Partial<EventFields>[] }>(person: T): T & EventFields {
  return { ...person, ...eventFieldsOf(person.participations[0]) }
}

// 送迎メモの入力値を整える（空なら null）。undefined は「変更しない」
export const normalizeMemo = (v: unknown): string | null | undefined =>
  v === undefined ? undefined : String(v ?? '').trim() || null
