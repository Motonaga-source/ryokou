// 汎用の送迎表（機能キー "transport"）の型・色・入力チェック（サーバー・画面の両方で使う）

export const SLOT_KINDS = [
  { key: 'car', label: '車', icon: '🚗' },
  { key: 'walk', label: '徒歩', icon: '🚶' },
  { key: 'other', label: 'その他', icon: '👪' },
] as const
export type SlotKind = (typeof SLOT_KINDS)[number]['key']
export const isSlotKind = (v: unknown): v is SlotKind => SLOT_KINDS.some(k => k.key === v)
export const slotKindOf = (key: string) => SLOT_KINDS.find(k => k.key === key) ?? SLOT_KINDS[2]

// 枠の色（Tailwind のクラスはここに全部書いておく。動的に組み立てない）
export const SLOT_COLORS = [
  { key: 'amber', label: '黄', box: 'bg-amber-50 border-amber-300', dot: 'bg-amber-400' },
  { key: 'green', label: '緑', box: 'bg-green-50 border-green-300', dot: 'bg-green-500' },
  { key: 'blue', label: '青', box: 'bg-blue-50 border-blue-300', dot: 'bg-blue-500' },
  { key: 'purple', label: '紫', box: 'bg-purple-50 border-purple-300', dot: 'bg-purple-500' },
  { key: 'pink', label: '桃', box: 'bg-pink-50 border-pink-300', dot: 'bg-pink-400' },
  { key: 'gray', label: '灰', box: 'bg-gray-50 border-gray-300', dot: 'bg-gray-400' },
] as const
export const isSlotColor = (v: unknown) => SLOT_COLORS.some(c => c.key === v)
// 色が未設定のときは種類で決める（車=黄・徒歩=緑・その他=紫）
export const slotColorOf = (color: string | null, kind: string) =>
  SLOT_COLORS.find(c => c.key === (color ?? { car: 'amber', walk: 'green' }[kind] ?? 'purple')) ?? SLOT_COLORS[0]

export interface TransportSlot {
  id: number
  sectionId: number
  name: string
  kind: string
  capacity: number | null
  color: string | null
  memo: string | null
  sortOrder: number
}

export interface TransportSection {
  id: number
  name: string
  time: string | null
  memo: string | null
  sortOrder: number
  slots: TransportSlot[]
}

export interface TransportPerson {
  id: number
  name: string
  role: string
  gender: string | null
  facility: string | null
  isWheelchair: boolean
  isFishNG: boolean
  pickupMemo: string | null // このイベントの送迎メモ
}

export interface TransportAssignment {
  personId: number
  slotId: number
  sortOrder: number
}

export interface TransportResponse {
  sections: TransportSection[]
  assignments: TransportAssignment[]
  persons: TransportPerson[] // このイベントに「参加」の人
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const optionalText = (v: unknown, max: number) => text(v, max) || null

export interface SectionInput {
  name: string
  time: string | null
  memo: string | null
}

export function parseSectionInput(body: Record<string, unknown>): SectionInput | string {
  const name = text(body.name, 50)
  if (!name) return '拠点の名前を入力してください'
  return { name, time: optionalText(body.time, 20), memo: optionalText(body.memo, 200) }
}

export interface SlotInput {
  name: string
  kind: SlotKind
  capacity: number | null
  color: string | null
  memo: string | null
}

export function parseSlotInput(body: Record<string, unknown>): SlotInput | string {
  const name = text(body.name, 50)
  if (!name) return '枠の名前を入力してください'
  if (!isSlotKind(body.kind)) return '枠の種類が不正です'
  let capacity: number | null = null
  if (body.capacity !== null && body.capacity !== undefined && body.capacity !== '') {
    const n = Number(body.capacity)
    if (!Number.isInteger(n) || n < 1 || n > 99) return '定員は1〜99の整数で入力してください（なしは空欄）'
    capacity = n
  }
  const color = body.color === null || body.color === undefined || body.color === '' ? null : body.color
  if (color !== null && !isSlotColor(color)) return '色が不正です'
  return { name, kind: body.kind, capacity, color: color as string | null, memo: optionalText(body.memo, 200) }
}
