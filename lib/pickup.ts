// 集合・送迎管理の定義（API・画面・シードで共通）

// バスの乗車拠点（工程表の巡回順）。各施設からこのバス停までの移動手段を管理する
export const PICKUP_LOCATIONS = [
  { id: 'yuzato', label: '湯里', title: '湯里エリア（第1乗車）', time: '8:30' },
  { id: 'grace', label: 'グレイス', title: 'グレイス・第二めぐむ保育園エリア（第2乗車）', time: '9:00' },
  { id: 'uriwari-nishi', label: '瓜破西', title: '瓜破西エリア（第3乗車）', time: '9:40' },
] as const

// 送迎車の所属先: 乗車拠点のいずれか、または「その他」（バス停を通らない個別の送迎など）
export const OTHER_LOCATION = { id: 'other', label: 'その他' } as const
export const VEHICLE_LOCATIONS = [...PICKUP_LOCATIONS, OTHER_LOCATION] as const

export type VehicleLocationId = (typeof VEHICLE_LOCATIONS)[number]['id']

export function isVehicleLocation(value: unknown): value is VehicleLocationId {
  return VEHICLE_LOCATIONS.some(l => l.id === value)
}

// 割り当て先のグループID
// - "walk-{拠点}": 施設から徒歩でバス停へ移動
// - "car-{送迎車id}": 送迎車
// - "family": 乗車拠点を通らない個別対応（家族送迎など）
export const walkGroupId = (location: string) => `walk-${location}`
export const vehicleGroupId = (vehicleId: number) => `car-${vehicleId}`
export const FAMILY_GROUP = { id: 'family', label: '個別対応（家族送迎など）', icon: '👪' } as const

export function vehicleIdOf(groupId: string): number | null {
  const m = groupId.match(/^car-(\d+)$/)
  return m ? Number(m[1]) : null
}

// 送迎車以外のグループID（徒歩でバス停へ移動・個別対応）か
export function isFixedPickupGroupId(value: unknown): boolean {
  return value === FAMILY_GROUP.id || PICKUP_LOCATIONS.some(l => walkGroupId(l.id) === value)
}

// 各拠点に1台ずつの初期送迎車
export const DEFAULT_PICKUP_VEHICLES = PICKUP_LOCATIONS.map(l => ({
  name: `${l.label}送迎車`,
  capacity: 4,
  location: l.id as string,
}))

export interface PickupVehicle {
  id: number
  name: string
  capacity: number
  location: string
}

export interface PickupAssignment {
  personId: number
  groupId: string
}

export interface PickupResponse {
  vehicles: PickupVehicle[]
  assignments: PickupAssignment[]
}

// 送迎車の入力値を検証（不正な場合はエラーメッセージを返す）
export function parseVehicleInput(body: Record<string, unknown>): Omit<PickupVehicle, 'id'> | string {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const capacity = Number(body.capacity)
  if (!name) return '車両名を入力してください'
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 99) return '定員は1〜99の整数で入力してください'
  if (!isVehicleLocation(body.location)) return '所属拠点が不正です'
  return { name, capacity, location: body.location }
}
