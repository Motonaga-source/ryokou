// イベントの型と表示用の関数（サーバー・ブラウザの両方で使う）

export const EVENT_COOKIE = 'event-id'

// 終了したイベント（閲覧専用）を選んでいても書き込める API
// （ログイン・イベントの切り替えと作成・編集・メニュー並び順は、どのイベントにも属さない全体の操作）
export const READ_ONLY_ALLOWED_API = ['/api/site-auth', '/api/auth', '/api/events', '/api/menu-order']
export const isReadOnlyAllowedApi = (path: string) =>
  READ_ONLY_ALLOWED_API.some(p => path === p || path.startsWith(p + '/'))

export interface EventSummary {
  id: number
  name: string
  startDate: string // ISO 文字列
  endDate: string
  status: 'ACTIVE' | 'CLOSED' // CLOSED = 終了（閲覧専用）
  modules: string[] // このイベントで使う機能のキー（lib/modules.ts）
}

export interface EventsResponse {
  events: EventSummary[]
  current: EventSummary | null
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// 日本時間の年月日
function jstParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() }
}

// 例: "10/29"
export const formatMonthDay = (iso: string) => {
  const p = jstParts(iso)
  return `${p.m}/${p.d}`
}

// 例: "10/29 〜 10/30"、1日だけなら "12/18"
export function formatEventPeriod(event: Pick<EventSummary, 'startDate' | 'endDate'>) {
  const start = formatMonthDay(event.startDate)
  const end = formatMonthDay(event.endDate)
  return start === end ? start : `${start} 〜 ${end}`
}

// イベントの日数（開始日〜終了日、日本時間の日付で数える。最低1日）
export function eventDayCount(event: Pick<EventSummary, 'startDate' | 'endDate'>) {
  const s = jstParts(event.startDate)
  const e = jstParts(event.endDate)
  const days = Math.round((Date.UTC(e.y, e.m - 1, e.d) - Date.UTC(s.y, s.m - 1, s.d)) / 86400000) + 1
  return Math.max(1, days)
}

// 例: dayNo=1 → "1日目（10/29・木）"。1日だけのイベントは "12/18（金）"
export function dayLabel(event: Pick<EventSummary, 'startDate' | 'endDate'>, dayNo: number) {
  const s = jstParts(event.startDate)
  const date = new Date(Date.UTC(s.y, s.m - 1, s.d + dayNo - 1))
  const md = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
  const w = WEEKDAYS[date.getUTCDay()]
  return eventDayCount(event) === 1 ? `${md}（${w}）` : `${dayNo}日目（${md}・${w}）`
}

// 短い表記 例: "1日目"。1日だけのイベントは "12/18"
export function dayShortLabel(event: Pick<EventSummary, 'startDate' | 'endDate'>, dayNo: number) {
  if (eventDayCount(event) > 1) return `${dayNo}日目`
  const s = jstParts(event.startDate)
  const date = new Date(Date.UTC(s.y, s.m - 1, s.d + dayNo - 1))
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
}

// イベントの日の番号の一覧 例: 2日間 → [1, 2]
export const eventDays = (event: Pick<EventSummary, 'startDate' | 'endDate'>) =>
  Array.from({ length: eventDayCount(event) }, (_, i) => i + 1)
