// 集合・送迎管理の定義（API・画面・シードで共通）

// 送迎車以外の集合方法
export const PICKUP_GROUPS = [
  { id: 'walk', label: '徒歩・自力集合', icon: '🚶', colorClass: 'bg-green-50 border-green-300' },
  { id: 'station', label: '駅迎え', icon: '🚉', colorClass: 'bg-sky-50 border-sky-300' },
  { id: 'family', label: '個別対応（家族送迎など）', icon: '👪', colorClass: 'bg-purple-50 border-purple-300' },
] as const

export const PICKUP_VEHICLE_IDS = [1, 2, 3, 4] as const

export const vehicleGroupId = (vehicleId: number) => `car-${vehicleId}`

export const DEFAULT_PICKUP_VEHICLES = PICKUP_VEHICLE_IDS.map(id => ({ id, name: `送迎車${id}`, capacity: 4 }))

export function isPickupGroupId(value: unknown): value is string {
  return typeof value === 'string' && (
    PICKUP_GROUPS.some(g => g.id === value) ||
    PICKUP_VEHICLE_IDS.some(id => vehicleGroupId(id) === value)
  )
}

export function isPickupVehicleId(value: unknown): value is number {
  return PICKUP_VEHICLE_IDS.some(id => id === value)
}

export interface PickupVehicle {
  id: number
  name: string
  capacity: number
}

export interface PickupAssignment {
  personId: number
  groupId: string
}

export interface PickupResponse {
  vehicles: PickupVehicle[]
  assignments: PickupAssignment[]
}
