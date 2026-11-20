// 汎用の席レイアウト（機能キー "seating"）の型・形・席の位置・入力チェック（サーバー・画面の両方で使う）
// 座標は配置図の左上を (0,0) とする論理ピクセル

export const TABLE_SHAPES = [
  { key: 'rect', label: '長方形（両側に座る）' },
  { key: 'counter', label: 'カウンター（片側に座る）' },
  { key: 'round', label: '丸テーブル' },
] as const
export type TableShape = (typeof TABLE_SHAPES)[number]['key']
export const isTableShape = (v: unknown): v is TableShape => TABLE_SHAPES.some(s => s.key === v)

export const LANDMARK_KINDS = [
  { key: 'entrance', label: '入口', icon: '🚪', className: 'bg-emerald-100 border-emerald-400 text-emerald-900' },
  { key: 'register', label: 'レジ', icon: '💴', className: 'bg-yellow-100 border-yellow-400 text-yellow-900' },
  { key: 'toilet', label: 'トイレ', icon: '🚻', className: 'bg-sky-100 border-sky-400 text-sky-900' },
  { key: 'drink', label: 'ドリンク・料理', icon: '🥤', className: 'bg-orange-100 border-orange-400 text-orange-900' },
  { key: 'stage', label: 'ステージ', icon: '🎤', className: 'bg-violet-100 border-violet-400 text-violet-900' },
  { key: 'wall', label: '壁・柱', icon: '🧱', className: 'bg-stone-300 border-stone-500 text-stone-800' },
  { key: 'other', label: 'その他', icon: '📍', className: 'bg-gray-100 border-gray-400 text-gray-800' },
] as const
export const isLandmarkKind = (v: unknown) => LANDMARK_KINDS.some(k => k.key === v)
export const landmarkKindOf = (key: string) => LANDMARK_KINDS.find(k => k.key === key) ?? LANDMARK_KINDS[LANDMARK_KINDS.length - 1]

export const MAX_SEATS = 30
export const GRID = 10 // 配置モードで動かすときの目盛り

export interface SeatTableData {
  id: number
  layoutId: number
  name: string
  shape: string
  seats: number
  wheelchairSlots: number
  x: number
  y: number
  memo: string | null
}

export interface SeatLandmarkData {
  id: number
  layoutId: number
  kind: string
  label: string
  x: number
  y: number
  w: number
  h: number
}

export interface SeatLayoutData {
  id: number
  name: string
  width: number
  height: number
  sortOrder: number
  tables: SeatTableData[]
  landmarks: SeatLandmarkData[]
}

export interface SeatAssignmentData {
  layoutId: number
  tableId: number
  seatIndex: number
  personId: number
}

export interface SeatPerson {
  id: number
  name: string
  role: string
  gender: string | null
  facility: string | null
  isWheelchair: boolean
  isFishNG: boolean
}

export interface SeatingResponse {
  layouts: SeatLayoutData[]
  assignments: SeatAssignmentData[]
  persons: SeatPerson[] // このイベントに「参加」の人
}

// 最後の wheelchairSlots 席が車椅子枠
export const isWheelchairSeat = (table: Pick<SeatTableData, 'seats' | 'wheelchairSlots'>, seatIndex: number) =>
  seatIndex >= table.seats - table.wheelchairSlots

// ===== テーブルの大きさと席の位置（論理ピクセル） =====
export const SEAT_W = 76
export const SEAT_H = 44
const GAP = 4
const BODY_H = 34
const PAD = 6

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface TableGeometry {
  w: number
  h: number
  body: Box & { round?: boolean }
  seats: Box[]
}

export function tableGeometry(table: Pick<SeatTableData, 'shape' | 'seats'>): TableGeometry {
  const n = Math.max(1, table.seats)
  if (table.shape === 'round') {
    // 丸テーブル: 円周に席を並べる（席どうしが重ならない半径にする）
    const r = Math.max(70, (n * (SEAT_W + GAP)) / (2 * Math.PI))
    const size = 2 * r + SEAT_H + 2 * PAD
    const c = size / 2
    const bodyR = Math.max(40, r - SEAT_H / 2 - 6)
    return {
      w: size + SEAT_W - SEAT_H,
      h: size,
      body: { x: c - bodyR + (SEAT_W - SEAT_H) / 2, y: c - bodyR, w: bodyR * 2, h: bodyR * 2, round: true },
      seats: Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n
        return { x: c + r * Math.cos(a) - SEAT_H / 2, y: c + r * Math.sin(a) - SEAT_H / 2, w: SEAT_W, h: SEAT_H }
      }),
    }
  }
  if (table.shape === 'counter') {
    // カウンター: 上に台、下に1列で座る
    const w = n * SEAT_W + (n - 1) * GAP + 2 * PAD
    return {
      w,
      h: PAD + BODY_H + GAP + SEAT_H + PAD,
      body: { x: PAD, y: PAD, w: w - 2 * PAD, h: BODY_H },
      seats: Array.from({ length: n }, (_, i) => ({ x: PAD + i * (SEAT_W + GAP), y: PAD + BODY_H + GAP, w: SEAT_W, h: SEAT_H })),
    }
  }
  // 長方形: 上の列に 0..cols-1、下の列に残り（左から）
  const cols = Math.ceil(n / 2)
  const w = Math.max(cols, 1) * SEAT_W + (Math.max(cols, 1) - 1) * GAP + 2 * PAD
  return {
    w,
    h: PAD + SEAT_H + GAP + BODY_H + GAP + SEAT_H + PAD,
    body: { x: PAD, y: PAD + SEAT_H + GAP, w: w - 2 * PAD, h: BODY_H },
    seats: Array.from({ length: n }, (_, i) => {
      const top = i < cols
      const col = top ? i : i - cols
      return { x: PAD + col * (SEAT_W + GAP), y: top ? PAD : PAD + SEAT_H + GAP + BODY_H + GAP, w: SEAT_W, h: SEAT_H }
    }),
  }
}

// ===== 入力チェック =====
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const int = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export interface LayoutInput {
  name: string
  width: number
  height: number
}

export function parseLayoutInput(body: Record<string, unknown>): LayoutInput | string {
  const name = text(body.name, 30)
  if (!name) return '配置図の名前を入力してください'
  const width = body.width === undefined ? 1200 : int(body.width)
  const height = body.height === undefined ? 800 : int(body.height)
  if (!Number.isInteger(width) || width < 600 || width > 3000) return '幅は600〜3000で入力してください'
  if (!Number.isInteger(height) || height < 400 || height > 3000) return '高さは400〜3000で入力してください'
  return { name, width, height }
}

export interface TableInput {
  name: string
  shape: TableShape
  seats: number
  wheelchairSlots: number
  memo: string | null
}

export function parseTableInput(body: Record<string, unknown>): TableInput | string {
  const name = text(body.name, 30)
  if (!name) return 'テーブルの名前を入力してください'
  if (!isTableShape(body.shape)) return 'テーブルの形が不正です'
  const seats = int(body.seats)
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) return `席数は1〜${MAX_SEATS}で入力してください`
  const wheelchairSlots = body.wheelchairSlots === undefined || body.wheelchairSlots === '' ? 0 : int(body.wheelchairSlots)
  if (!Number.isInteger(wheelchairSlots) || wheelchairSlots < 0 || wheelchairSlots > seats) return '車椅子枠は0〜席数の範囲で入力してください'
  return { name, shape: body.shape, seats, wheelchairSlots, memo: text(body.memo, 100) || null }
}

export interface LandmarkInput {
  kind: string
  label: string
  w: number
  h: number
}

export function parseLandmarkInput(body: Record<string, unknown>): LandmarkInput | string {
  if (!isLandmarkKind(body.kind)) return '目印の種類が不正です'
  const label = text(body.label, 20) || landmarkKindOf(String(body.kind)).label
  const w = body.w === undefined ? 120 : int(body.w)
  const h = body.h === undefined ? 60 : int(body.h)
  if (!Number.isInteger(w) || w < 20 || w > 3000 || !Number.isInteger(h) || h < 20 || h > 3000) return '目印の大きさは20〜3000で入力してください'
  return { kind: String(body.kind), label, w, h }
}

// 位置（配置図の中に収める。目盛りに合わせる）
export function parsePosition(body: Record<string, unknown>, size: { w: number; h: number }, layout: { width: number; height: number }) {
  const x = int(body.x)
  const y = int(body.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return {
    x: clamp(Math.round(x / GRID) * GRID, 0, Math.max(0, layout.width - size.w)),
    y: clamp(Math.round(y / GRID) * GRID, 0, Math.max(0, layout.height - size.h)),
  }
}
