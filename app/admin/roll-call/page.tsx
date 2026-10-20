'use client'

import { useCallback, useEffect, useState } from 'react'
import FishNGBadge from '@/components/FishNGBadge'
import { sortPersons } from '@/lib/bathing'
import {
  FAMILY_GROUP,
  OTHER_LOCATION,
  PICKUP_LOCATIONS,
  vehicleIdOf,
  walkGroupId,
  type PickupVehicle,
} from '@/lib/pickup'

interface RollCallPerson {
  id: number
  name: string
  role: string
  gender: string | null
  isWheelchair: boolean
  isFishNG: boolean
  isRollCalled: boolean
}

interface RollCallData {
  persons: RollCallPerson[]
  vehicles: PickupVehicle[]
  pickups: { personId: number; groupId: string }[]
  teams: { id: number; name: string; memberIds: number[] }[]
  busSeats: { personId: number; vehicle: string | null; rowNo: number | null; seatSide: string | null }[]
  cars: { id: number; name: string; memberIds: number[] }[]
}

interface Group {
  key: string
  title: string
  members: { person: RollCallPerson; note?: string; seat?: { row: number; side: string } }[]
  // 'bus' のときは実際のバスの座席配置（A・B ｜通路｜ C・D）で表示する
  layout?: 'bus'
}

type GroupMode = 'bus' | 'pickup' | 'team' | 'role'

// 画面を開いたときは必ずバス座席順で表示する
const DEFAULT_GROUP_MODE: GroupMode = 'bus'

const GROUP_MODES: { value: GroupMode; label: string }[] = [
  { value: 'bus', label: '🚌 バス座席' },
  { value: 'pickup', label: '🚏 乗車拠点' },
  { value: 'team', label: '📋 チーム' },
  { value: 'role', label: '👥 スタッフ／利用者' },
]

async function loadRollCall(): Promise<RollCallData> {
  const res = await fetch('/api/roll-call?tripId=1')
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '読み込みに失敗しました')
  return res.json()
}

// 点呼のグループ分け（未割り当ての人も漏れないよう最後のグループに入れる）
function buildGroups(data: RollCallData, mode: GroupMode): Group[] {
  const sorted = sortPersons(data.persons)
  const byGroup = (title: string, key: string, list: Group['members']): Group => ({ key, title, members: list })

  if (mode === 'role') {
    return [
      byGroup('スタッフ', 'staff', sorted.filter(p => p.role === 'STAFF').map(person => ({ person }))),
      byGroup('利用者', 'user', sorted.filter(p => p.role !== 'STAFF').map(person => ({ person }))),
    ].filter(g => g.members.length > 0)
  }

  if (mode === 'bus') {
    // 大型バスは座席順（前の列から、A→E）、乗用車は車両ごと。どちらにも乗らない人は最後に「未割り当て」
    const seatOf = new Map(data.busSeats.map(s => [s.personId, s]))
    const used = new Set<number>()
    const vehicles = [...new Set(data.busSeats.map(s => s.vehicle ?? '1号車'))].sort()
    const groups: Group[] = vehicles.map(vehicle => {
      const members = data.persons
        .filter(p => {
          const seat = seatOf.get(p.id)
          return seat && (seat.vehicle ?? '1号車') === vehicle
        })
        .sort((a, b) => {
          const sa = seatOf.get(a.id)!, sb = seatOf.get(b.id)!
          return (sa.rowNo ?? 99) - (sb.rowNo ?? 99) || (sa.seatSide ?? '').localeCompare(sb.seatSide ?? '')
        })
      members.forEach(p => used.add(p.id))
      return {
        ...byGroup(
          vehicle === '1号車' ? '大型バス（1号車）' : `大型バス（${vehicle}）`,
          `bus-${vehicle}`,
          members.map(person => {
            const seat = seatOf.get(person.id)!
            return seat.rowNo && seat.seatSide
              ? { person, note: `💺 ${seat.rowNo}列 ${seat.seatSide}席`, seat: { row: seat.rowNo, side: seat.seatSide } }
              : { person, note: '座席番号なし' }
          }),
        ),
        layout: 'bus' as const,
      }
    })
    for (const car of data.cars) {
      const ids = new Set(car.memberIds)
      const members = sorted.filter(p => ids.has(p.id) && !used.has(p.id))
      members.forEach(p => used.add(p.id))
      groups.push(byGroup(`乗用車（${car.name}）`, `car-${car.id}`, members.map(person => ({ person, note: `🚙 ${car.name}` }))))
    }
    groups.push(byGroup('未割り当て', 'bus-none', sorted.filter(p => !used.has(p.id)).map(person => ({ person }))))
    return groups.filter(g => g.members.length > 0)
  }

  if (mode === 'team') {
    const used = new Set<number>()
    const groups = data.teams.map(t => {
      const ids = new Set(t.memberIds)
      const members = sorted.filter(p => ids.has(p.id) && !used.has(p.id))
      members.forEach(p => used.add(p.id))
      return byGroup(t.name, `team-${t.id}`, members.map(person => ({ person })))
    })
    groups.push(byGroup('チーム未所属', 'team-none', sorted.filter(p => !used.has(p.id)).map(person => ({ person }))))
    return groups.filter(g => g.members.length > 0)
  }

  // 乗車拠点ごと（徒歩・送迎車をまとめ、送迎車名を補足に表示）
  const groupOf = new Map(data.pickups.map(a => [a.personId, a.groupId]))
  const vehicleById = new Map(data.vehicles.map(v => [v.id, v]))
  const locationOf = (groupId: string | undefined): { location: string; note: string } | null => {
    if (!groupId) return null
    if (groupId === FAMILY_GROUP.id) return { location: OTHER_LOCATION.id, note: '個別対応' }
    const walk = PICKUP_LOCATIONS.find(l => walkGroupId(l.id) === groupId)
    if (walk) return { location: walk.id, note: '徒歩' }
    const vehicleId = vehicleIdOf(groupId)
    const vehicle = vehicleId !== null ? vehicleById.get(vehicleId) : undefined
    return vehicle ? { location: vehicle.location, note: `🚗 ${vehicle.name}` } : null
  }

  const placed = sorted.map(person => ({ person, place: locationOf(groupOf.get(person.id)) }))
  const groups = [
    ...PICKUP_LOCATIONS.map(l => ({ key: l.id, title: `${l.title}　${l.time}` })),
    { key: OTHER_LOCATION.id, title: 'その他（個別対応・その他の送迎車）' },
  ].map(g => byGroup(
    g.title,
    g.key,
    placed.filter(x => x.place?.location === g.key).map(x => ({ person: x.person, note: x.place?.note })),
  ))
  groups.push(byGroup('集合方法 未割り当て', 'none', placed.filter(x => !x.place).map(x => ({ person: x.person }))))
  return groups.filter(g => g.members.length > 0)
}

export default function RollCallPage() {
  const [data, setData] = useState<RollCallData | null>(null)
  const [mode, setMode] = useState<GroupMode>(DEFAULT_GROUP_MODE)
  const [onlyUnchecked, setOnlyUnchecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setData(await loadRollCall())
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    }
  }, [])

  useEffect(() => {
    loadRollCall().then(setData).catch(e => setError(e instanceof Error ? e.message : '読み込みに失敗しました'))
  }, [])

  const setChecked = (id: number, isRollCalled: boolean) =>
    setData(d => d && { ...d, persons: d.persons.map(p => (p.id === id ? { ...p, isRollCalled } : p)) })

  const toggle = async (person: RollCallPerson) => {
    const next = !person.isRollCalled
    setChecked(person.id, next) // Optimistic UI
    const res = await fetch(`/api/roll-call/${person.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRollCalled: next }),
    })
    if (!res.ok) {
      setChecked(person.id, !next)
      setError((await res.json().catch(() => ({}))).error || '保存に失敗しました')
    } else {
      setError(null)
    }
  }

  const clearAll = async () => {
    if (!confirm('全員のチェックをクリアします。よろしいですか？')) return
    setClearing(true)
    const res = await fetch('/api/roll-call?tripId=1', { method: 'DELETE' })
    setClearing(false)
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'クリアに失敗しました')
      return
    }
    setError(null)
    setOnlyUnchecked(false)
    await refresh()
  }

  const total = data?.persons.length ?? 0
  const checked = data?.persons.filter(p => p.isRollCalled).length ?? 0
  const complete = total > 0 && checked === total
  const groups = data ? buildGroups(data, mode) : []

  return (
    <div className="space-y-4">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">📝 点呼チェック</h1>
        <p className="text-sm text-gray-500 mt-1">名前をタップすると ✅ が付きます。点呼が終わったら「全てのチェックをクリア」で次の乗車に使い回せます。</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* 進捗（スクロールしても常に見えるように固定） */}
      {/* スマホでは左上の ☰ ボタンと重ならないよう左に余白を取る */}
      <div className={`sticky top-0 z-20 -mx-4 lg:-mx-6 pl-16 pr-4 lg:px-6 py-3 border-b-2 shadow-sm ${
        complete ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
      }`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`text-3xl font-black tabular-nums ${complete ? 'text-green-600' : 'text-gray-800'}`}>
            {data ? checked : '…'}<span className="text-xl text-gray-400"> / {data ? total : '…'}名</span>
          </div>
          {data && (
            <div className="text-sm font-bold">
              {complete ? <span className="text-green-700">🎉 全員確認済み</span> : <span className="text-red-600">未確認 {total - checked}名</span>}
            </div>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOnlyUnchecked(v => !v)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 ${
                onlyUnchecked ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {onlyUnchecked ? '全員を表示' : '未確認のみ表示'}
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={clearing || checked === 0}
              className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-700 text-white disabled:opacity-40"
            >
              {clearing ? 'クリア中...' : '🔄 全てのチェックをクリア'}
            </button>
          </div>
        </div>
        <div className="mt-2 h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${total ? (checked / total) * 100 : 0}%` }} />
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto">
          {GROUP_MODES.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                mode === m.value ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="text-center py-10 text-gray-400">{error ? '' : '読み込み中...'}</div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => {
            const groupChecked = group.members.filter(m => m.person.isRollCalled).length
            const shown = onlyUnchecked ? group.members.filter(m => !m.person.isRollCalled) : group.members
            if (onlyUnchecked && shown.length === 0) return null
            const groupDone = groupChecked === group.members.length
            return (
              <section key={group.key}>
                <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 mb-2 ${
                  groupDone ? 'bg-green-100 text-green-800' : 'bg-gray-800 text-white'
                }`}>
                  <h2 className="font-bold text-sm min-w-0">{group.title}</h2>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {groupDone ? '✅ ' : ''}{groupChecked}/{group.members.length}名
                  </span>
                </div>
                {group.layout === 'bus' ? (
                  <BusSeatGrid members={group.members} onlyUnchecked={onlyUnchecked} onToggle={toggle} />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {shown.map(({ person, note }) => (
                      <RollCallButton key={person.id} person={person} note={note} onToggle={() => toggle(person)} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
          {onlyUnchecked && complete && (
            <p className="text-center text-green-700 font-bold py-6">🎉 未確認の人はいません</p>
          )}
        </div>
      )}
    </div>
  )
}

function RollCallButton({ person, note, onToggle }: { person: RollCallPerson; note?: string; onToggle: () => void }) {
  const color = person.isRollCalled
    ? 'bg-green-100 border-green-500'
    : person.isWheelchair
    ? 'bg-pink-100 border-pink-400'
    : person.role === 'STAFF'
    ? 'bg-blue-100 border-blue-300'
    : 'bg-white border-gray-300'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={person.isRollCalled}
      className={`min-h-14 w-full rounded-xl border-2 px-3 py-2 flex items-center gap-2 text-left transition-colors active:scale-[0.98] ${color}`}
    >
      {person.isRollCalled ? (
        <span className="shrink-0 text-2xl leading-none">✅</span>
      ) : (
        <span className="shrink-0 w-6 h-6 rounded-md border-2 border-gray-400 bg-white" aria-hidden />
      )}
      <span className="flex-1 min-w-0">
        {/* スマホの2列表示でも名前が省略されないよう折り返す */}
        <span className={`flex flex-wrap items-center gap-x-1 font-bold text-base leading-tight ${person.isRollCalled ? 'text-green-800' : 'text-gray-800'}`}>
          {person.isWheelchair && <span className="shrink-0 text-sm">♿️</span>}
          <span className="min-w-0 break-words">{person.name}</span>
          {person.isFishNG && <FishNGBadge />}
        </span>
        {note && <span className="block text-[11px] text-gray-500 truncate">{note}</span>}
      </span>
    </button>
  )
}

// ===== バス座席レイアウト（横4席＋通路。最後列は A〜E の5席） =====
// バス座席表・印刷用のバス座席表と同じ向き（上が最後列、下が前方の1列目）

const BUS_GRID = 'grid grid-cols-[1.25rem_1fr_1fr_0.75rem_1fr_1fr] gap-1'
const BACK_ROW_SIDES = ['A', 'B', 'C', 'D', 'E']

function BusSeatGrid({ members, onlyUnchecked, onToggle }: {
  members: Group['members']
  onlyUnchecked: boolean
  onToggle: (person: RollCallPerson) => void
}) {
  const bySeat = new Map(members.filter(m => m.seat).map(m => [`${m.seat!.row}${m.seat!.side}`, m.person]))
  const noSeat = members.filter(m => !m.seat)
  const lastRow = Math.max(12, ...members.map(m => m.seat?.row ?? 0))
  const rows = Array.from({ length: lastRow }, (_, i) => lastRow - i) // 上が最後列、下が1列目
  const seat = (row: number, side: string) => (
    <BusSeatButton
      key={side}
      code={`${row}${side}`}
      person={bySeat.get(`${row}${side}`)}
      dim={onlyUnchecked}
      onToggle={onToggle}
    />
  )

  return (
    <div className="mx-auto max-w-xl rounded-2xl border-2 border-gray-300 bg-gray-50 p-1.5 sm:p-3">
      <div className="mb-1.5 rounded bg-gray-200 py-0.5 text-center text-[10px] font-bold text-gray-600">後方</div>
      <div className={`${BUS_GRID} mb-1 text-center text-[10px] font-bold text-gray-500`}>
        <span />
        <span>A</span>
        <span>B</span>
        <span />
        <span>C</span>
        <span>D</span>
      </div>
      <div className="space-y-1">
        {rows.map(row => (
          <div key={row} className={BUS_GRID}>
            <span className="flex items-center justify-center rounded bg-gray-200 text-[10px] font-bold text-gray-600">{row}</span>
            {row === lastRow ? (
              // 最後列は通路をふさいで5席
              <div className="col-span-5 grid grid-cols-5 gap-1">{BACK_ROW_SIDES.map(side => seat(row, side))}</div>
            ) : (
              <>
                {seat(row, 'A')}
                {seat(row, 'B')}
                <span aria-hidden className="border-x border-dashed border-gray-300" />
                {seat(row, 'C')}
                {seat(row, 'D')}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 rounded bg-gray-200 py-0.5 text-center text-[10px] font-bold text-gray-600">▼ 前方（運転席・乗降口）</div>
      {noSeat.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-gray-500 mb-1">座席番号なし（{noSeat.length}名）</p>
          <div className="grid grid-cols-3 gap-1">
            {noSeat.map(({ person }) => (
              <BusSeatButton key={person.id} code="—" person={person} dim={onlyUnchecked} onToggle={onToggle} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 1座席ぶんのボタン。カード全体をタップして確認済み（緑）／未確認（白）を切り替える
function BusSeatButton({ code, person, dim, onToggle }: {
  code: string
  person?: RollCallPerson
  dim: boolean // 「未確認のみ表示」のとき、確認済みの席を薄くする（座席の位置は保つ）
  onToggle: (person: RollCallPerson) => void
}) {
  if (!person) {
    return (
      <div className="min-h-11 rounded-md border border-dashed border-gray-200 bg-white/50 flex items-center justify-center text-[9px] text-gray-300">
        {code}
      </div>
    )
  }

  const checked = person.isRollCalled
  const border = checked
    ? 'border-green-500'
    : person.isWheelchair
    ? 'border-pink-400'
    : person.role === 'STAFF'
    ? 'border-blue-300'
    : 'border-gray-300'

  return (
    <button
      type="button"
      onClick={() => onToggle(person)}
      aria-pressed={checked}
      title={`${code} ${person.name}`}
      className={`relative min-h-11 min-w-0 rounded-md border-2 px-1 py-0.5 text-left transition-colors active:scale-95 ${border} ${
        checked ? 'bg-green-100 text-green-900' : 'bg-white text-gray-800'
      } ${dim && checked ? 'opacity-25' : ''}`}
    >
      <span className="flex items-center justify-between text-[8px] leading-none text-gray-400">
        <span>{code}</span>
        {checked && <span className="text-[11px] font-black text-green-600">✓</span>}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-0.5 text-[11px] font-bold leading-tight">
        {person.isWheelchair && <span className="text-[9px]">♿️</span>}
        <span className="min-w-0 break-words [word-break:keep-all]">{person.name}</span>
        {person.isFishNG && <span className="text-[8px]">🐟❌</span>}
      </span>
    </button>
  )
}
