// 印刷専用まとめページ（閲覧・印刷専用）
// DnD は使わず、DB のデータをシンプルな div / table で A4 縦に並べる。未割り当ての人は表示しない
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Fragment, type ReactNode } from 'react'
import { prisma } from '@/lib/prisma'
import { BATHING_ROLES, BATH_BADGES, sectionsByBan, sortPersons } from '@/lib/bathing'
import { BANQUET_COLUMNS, tablesOf } from '@/lib/banquet'
import { FAMILY_GROUP, OTHER_LOCATION, PICKUP_LOCATIONS, vehicleGroupId, walkGroupId } from '@/lib/pickup'
import { SUPPLY_CATEGORIES, WHEELCHAIR_LOAN } from '@/lib/supplies'
import { LunchFloorPlan } from '@/components/LunchFloorPlan'
import BanSectionLabel from '@/components/BanSectionLabel'
import SeatingPlanStatic from '@/components/SeatingPlanStatic'
import PrintButton from './PrintButton'
import { getCurrentEvent } from '@/lib/event'
import { dayLabel, eventDays } from '@/lib/event-shared'
import { loadTransport } from '@/lib/transport-server'
import { slotKindOf, type TransportResponse } from '@/lib/transport'
import { loadSeating } from '@/lib/seating-server'
import { isWheelchairSeat, type SeatingResponse, type SeatPerson } from '@/lib/seating'

export const metadata: Metadata = { title: '印刷用まとめ | 旅行管理システム' }

const BUS_ROWS = Array.from({ length: 12 }, (_, i) => 12 - i)

// 部屋番号が数字だけのときだけ「号室」を付ける（"363トリプルベッド" のような名前はそのまま）
const roomLabel = (roomNumber: string) => (/^\d+$/.test(roomNumber.trim()) ? `${roomNumber}号室` : roomNumber)

interface P {
  id: number
  name: string
  role: string
  gender: string | null
  isWheelchair: boolean
  isFishNG: boolean
  wheelchairSource: string | null
}

export default async function PrintPage() {
  const event = await getCurrentEvent()
  if (!event) return <p className="p-8">イベントが登録されていません。</p>
  const TRIP_ID = event.id
  const days = eventDays(event)
  // 選択中のイベントで ON の機能のページだけを印刷する
  const modules = event.modules
  const [transport, seating] = await Promise.all([
    modules.includes('transport') ? loadTransport(TRIP_ID) : null,
    modules.includes('seating') ? loadSeating(TRIP_ID) : null,
  ])
  const [trip, personRows, schedules, supplies, vehicles, pickups, busSeats, cars, rooms, teams, bathing, banquet, lunchTables, lunchSeats] =
    await Promise.all([
      prisma.trip.findUnique({ where: { id: TRIP_ID } }),
      prisma.person.findMany({
        where: { participations: { some: { tripId: TRIP_ID, status: '参加' } } },
        select: {
          id: true, name: true, role: true, gender: true, isWheelchair: true, isFishNG: true,
          participations: { where: { tripId: TRIP_ID }, select: { wheelchairSource: true } },
        },
        orderBy: { id: 'asc' },
      }),
      prisma.schedule.findMany({ where: { tripId: TRIP_ID }, orderBy: [{ dayNo: 'asc' }, { sortOrder: 'asc' }] }),
      prisma.supplyItem.findMany({ where: { tripId: TRIP_ID }, orderBy: { id: 'asc' } }),
      prisma.pickupVehicle.findMany({ where: { tripId: TRIP_ID }, orderBy: { id: 'asc' } }),
      prisma.pickupAssignment.findMany({ where: { tripId: TRIP_ID } }),
      prisma.busSeatAssignment.findMany({ where: { tripId: TRIP_ID, vehicle: '1号車' } }),
      prisma.car.findMany({ where: { tripId: TRIP_ID }, include: { assignments: true }, orderBy: { id: 'asc' } }),
      prisma.room.findMany({ where: { tripId: TRIP_ID }, include: { assignments: true }, orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }] }),
      prisma.team.findMany({ where: { tripId: TRIP_ID }, include: { members: true }, orderBy: { id: 'asc' } }),
      prisma.bathingAssignment.findMany({ where: { tripId: TRIP_ID } }),
      prisma.banquetSeatAssignment.findMany({ where: { tripId: TRIP_ID } }),
      prisma.lunchTable.findMany({ where: { tripId: TRIP_ID } }),
      prisma.lunchSeatAssignment.findMany({ where: { tripId: TRIP_ID } }),
    ])

  // 車椅子の出所は、このイベントの参加レコードの値
  const persons: P[] = personRows.map(({ participations, ...p }) => ({ ...p, wheelchairSource: participations[0]?.wheelchairSource ?? null }))

  // 参加者のみを対象にする（不参加・保留の人の割り当ては表示しない）
  const byId = new Map(persons.map(p => [p.id, p]))
  const pick = (ids: number[]) => sortPersons(ids.map(id => byId.get(id)).filter((p): p is P => !!p))

  const pickupMembers = (groupId: string) => pick(pickups.filter(a => a.groupId === groupId).map(a => a.personId))
  const seatPerson = (row: number, side: string) => {
    const a = busSeats.find(s => s.rowNo === row && s.seatSide === side)
    return a ? byId.get(a.personId) : undefined
  }
  const banquetBySeat = new Map(banquet.map(a => [a.seatId, byId.get(a.personId)]))
  const banByPerson = new Map(bathing.map(b => [b.personId, b.banNumber]))

  const md = (d: Date) => d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' })
  // 日帰りのイベントは日付を1つだけ表示する
  const dateLabel = trip ? (md(trip.startDate) === md(trip.endDate) ? md(trip.startDate) : `${md(trip.startDate)} 〜 ${md(trip.endDate)}`) : ''

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-black p-[10mm] print:p-0 print:max-w-none text-[12px] leading-snug">
      <PrintButton />

      <header className="mb-4 border-b-2 border-black pb-2">
        <h1 className="text-xl font-bold">{trip?.name ?? '旅行'} 印刷用まとめ</h1>
        <p className="text-[11px]">
          {dateLabel}　{trip?.destination}　参加者 {persons.length}名（スタッフ {persons.filter(p => p.role === 'STAFF').length}名）
        </p>
        <Legend />
      </header>

      {arrangeSections(modules, [
        { key: 'schedule', title: 'スケジュール', node: (title: string) => (
      <Section title={title}>
        {days.map(day => {
          const list = schedules.filter(s => s.dayNo === day)
          return (
            // 1日目と2日目は別の用紙に分ける
            <div key={day} className={day < days.length ? 'break-after-page' : ''}>
              <SubHeading>{dayLabel(event, day)}</SubHeading>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-gray-100">
                    <Th className="w-16">時刻</Th>
                    <Th>内容</Th>
                    <Th className="w-[30%]">詳細</Th>
                    <Th className="w-24">担当</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(s => (
                    <tr key={s.id} className="print-avoid-break">
                      <Td className="font-bold whitespace-nowrap">{s.timeLabel}</Td>
                      <Td>{s.location}</Td>
                      <Td className="whitespace-pre-wrap">{s.description}</Td>
                      <Td>{s.assignedTo}</Td>
                    </tr>
                  ))}
                  {list.length === 0 && <tr><Td className="text-gray-500" colSpan={4}>予定がありません</Td></tr>}
                </tbody>
              </table>
            </div>
          )
        })}
      </Section>
        ) },
        { key: 'supplies', title: '持ち物リスト', node: (title: string) => (
      <Section title={title}>
        <div className="grid grid-cols-2 gap-4">
          <Box title="共通備品（グレイス準備）">
            <CheckList items={supplies.filter(s => s.category === SUPPLY_CATEGORIES.COMMON).map(s => s.itemName)} />
          </Box>
          <Box title="施設別の薬（担当者一括管理）">
            <CheckList items={supplies.filter(s => s.category === SUPPLY_CATEGORIES.MEDICINE).map(s => s.itemName)} />
          </Box>
          {(() => {
            const loans = sortPersons(persons.filter(p => p.wheelchairSource === WHEELCHAIR_LOAN))
            return (
              <Box title={`貸出用車椅子（グレイス準備）　必要台数：${loans.length}台`}>
                <CheckList items={loans.map(p => p.name)} />
              </Box>
            )
          })()}
        </div>
      </Section>
        ) },
        { key: 'pickup', title: '集合・バス停への移動手段', node: (title: string) => (
      <Section title={title}>
        <div className="space-y-3">
          {PICKUP_LOCATIONS.map(loc => (
            <div key={loc.id} className="print-avoid-break">
              <h3 className="font-bold bg-gray-800 text-white px-2 py-1">{loc.title}　🕗 {loc.time}</h3>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                <Box title={`🚶 徒歩でバス停へ移動（${loc.label}）`} className="col-span-2">
                  <NameList persons={pickupMembers(walkGroupId(loc.id))} columns={2} />
                </Box>
                {vehicles.filter(v => v.location === loc.id).map(v => (
                  <VehicleBox key={v.id} name={v.name} capacity={v.capacity} persons={pickupMembers(vehicleGroupId(v.id))} />
                ))}
              </div>
            </div>
          ))}
          <div className="print-avoid-break">
            <h3 className="font-bold bg-gray-800 text-white px-2 py-1">その他（個別対応・その他の送迎車）</h3>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              <Box title={`${FAMILY_GROUP.icon} ${FAMILY_GROUP.label}`}>
                <NameList persons={pickupMembers(FAMILY_GROUP.id)} />
              </Box>
              {vehicles.filter(v => v.location === OTHER_LOCATION.id).map(v => (
                <VehicleBox key={v.id} name={v.name} capacity={v.capacity} persons={pickupMembers(vehicleGroupId(v.id))} />
              ))}
            </div>
          </div>
        </div>
      </Section>
        ) },
        { key: 'bus', title: 'バス座席表', node: (title: string) => (
      <Section title={title}>
        <SubHeading>大型バス（1号車）</SubHeading>
        <div className="mx-auto max-w-[170mm] rounded-2xl border-2 border-gray-500 bg-gray-50 p-3 print-avoid-break">
          <div className="text-center text-[10px] font-bold text-gray-500 tracking-[0.5em] mb-2">後方</div>
          {/* 列ヘッダー */}
          <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem_1fr_1fr] gap-1.5 mb-1.5 text-center text-[10px] font-bold text-gray-600">
            <span />
            <span className="rounded bg-gray-200 py-0.5">A</span>
            <span className="rounded bg-gray-200 py-0.5">B</span>
            <span className="text-[9px] text-gray-400 self-center">通路</span>
            <span className="rounded bg-gray-200 py-0.5">C</span>
            <span className="rounded bg-gray-200 py-0.5">D</span>
          </div>
          <div className="space-y-1.5">
            {BUS_ROWS.map(row => (
              <div key={row} className="grid grid-cols-[2rem_1fr_1fr_2.5rem_1fr_1fr] gap-1.5">
                <span className="rounded bg-gray-200 text-[11px] font-bold text-gray-700 flex items-center justify-center">{row}</span>
                {row === 12 ? (
                  // 最後列は通路をふさいで A〜E の5席
                  <div className="col-span-5 grid grid-cols-5 gap-1.5">
                    {['A', 'B', 'C', 'D', 'E'].map(side => (
                      <BusSeat key={side} code={`${row}${side}`} person={seatPerson(row, side)} />
                    ))}
                  </div>
                ) : (
                  <>
                    <BusSeat code={`${row}A`} person={seatPerson(row, 'A')} />
                    <BusSeat code={`${row}B`} person={seatPerson(row, 'B')} />
                    <span className="border-x-2 border-dashed border-gray-300" aria-hidden />
                    <BusSeat code={`${row}C`} person={seatPerson(row, 'C')} />
                    <BusSeat code={`${row}D`} person={seatPerson(row, 'D')} />
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-stretch gap-2 border-t-4 border-gray-400 pt-2 text-[10px] font-bold text-gray-600">
            <span className="rounded-lg border-2 border-gray-400 bg-gray-200 px-3 py-2">🚌 運転席</span>
            <span className="flex-1 self-center text-center tracking-[0.5em] text-gray-500">前方</span>
            <span className="rounded-lg border-2 border-dashed border-gray-400 bg-white px-3 py-2">乗降口</span>
          </div>
        </div>

        {cars.length > 0 && (
          <>
            <SubHeading className="mt-5">乗用車（送迎・別働）</SubHeading>
            <div className="grid grid-cols-3 gap-2">
              {cars.map(car => (
                <VehicleBox
                  key={car.id}
                  name={car.name}
                  capacity={car.capacity}
                  persons={pick(car.assignments.map(a => a.personId))}
                />
              ))}
            </div>
          </>
        )}
      </Section>
        ) },
        { key: 'rooms', title: '部屋割り', node: (title: string) => (
      <Section title={title}>
        <div className="grid grid-cols-3 gap-2">
          {rooms.map(room => {
            const members = pick(room.assignments.map(a => a.personId))
            return (
              <Box
                key={room.id}
                title={`${roomLabel(room.roomNumber)}（${room.floor}F・${room.roomType}）`}
                right={`${members.length}/${room.capacity}名`}
              >
                <NameList persons={members} />
              </Box>
            )
          })}
        </div>
      </Section>
        ) },
        { key: 'teams', title: '班分け（チーム・配置）', node: (title: string) => (
      <Section title={title}>
        <div className="grid grid-cols-3 gap-2">
          {teams.map(team => {
            const leaderIds = new Set(team.members.filter(m => m.isLeader).map(m => m.personId))
            const members = pick(team.members.map(m => m.personId))
            return (
              <Box key={team.id} title={team.name} right={`${members.length}名`}>
                <NameList persons={members} leaderIds={leaderIds} />
              </Box>
            )
          })}
        </div>
        <p className="text-[10px] mt-1">★ はリーダー</p>
      </Section>
        ) },
        { key: 'bathing', title: '入浴管理', node: (title: string) => (
      <Section title={title}>
        <div className="grid grid-cols-2 gap-2">
          {BATHING_ROLES.map(role => {
            // スタッフは班なし（担当）、利用者は班（入浴の順番）ごと
            const sorted = sortPersons(
              pick(bathing.filter(b => b.role === role.value).map(b => b.personId))
                .map(p => ({ ...p, banNumber: p.role === 'STAFF' ? null : banByPerson.get(p.id) ?? null })),
            )
            return (
              <Box
                key={role.value}
                title={
                  <>
                    {role.icon} {role.baseLabel}
                    {role.bath && (
                      <span className={`ml-1 px-1 rounded text-[10px] ${BATH_BADGES[role.bath].className}`}>{BATH_BADGES[role.bath].label}</span>
                    )}
                  </>
                }
                right={`${sorted.length}名`}
              >
                <div className="space-y-1.5">
                  {sectionsByBan(sorted).map(sec => (
                    <div key={sec.key} className="break-inside-avoid space-y-0.5">
                      <BanSectionLabel sectionKey={sec.key} label={sec.label} count={sec.persons.length} />
                      {/* 人数が多い見出しは2列にして、入浴管理が A4 1枚に収まるようにする */}
                      <NameList persons={sec.persons} columns={sec.persons.length > 4 ? 2 : 1} />
                    </div>
                  ))}
                  {sorted.length === 0 && <p className="text-[10px] text-gray-400">（なし）</p>}
                </div>
              </Box>
            )
          })}
        </div>
      </Section>
        ) },
        { key: 'banquet', title: '宴会 席順', node: (title: string) => (
      <Section title={title}>
        <div className="grid grid-cols-3 gap-3">
          {BANQUET_COLUMNS.map(column => (
            <div key={column.key} className="rounded-xl border border-gray-400 bg-gray-50 p-2 space-y-2.5">
              <div className="rounded bg-gray-200 py-0.5 text-center text-[11px] font-bold">{column.label}</div>
              {tablesOf(column.key).map(table => (
                <BanquetTable
                  key={table.key}
                  label={table.label}
                  seats={table.seatIds.map(seatId => ({ seatId, person: banquetBySeat.get(seatId) }))}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-red-700 text-white text-center font-bold py-1.5 tracking-[1em]">舞台</div>
      </Section>
        ) },
        { key: 'lunch', title: '昼食 席順（2日目 13:00 伊賀の里もくもく手づくりファーム）', landscape: true, node: (title: string) => (
      // 昼食 席順（管理画面と同じ座席図面）。このページは A4 横向きで印刷する（globals.css の @page lunch-landscape）
      <div className="print-landscape-page">
      <Section title={title}>
        {(() => {
          const wheelchairUsers = persons.filter(p => p.isWheelchair).length
          const slots = lunchTables.reduce((n, t) => n + t.wheelchairSlots, 0)
          return (
            <p className="text-[11px] mb-2">
              ♿ 車椅子利用 {wheelchairUsers}名 ／ 車椅子枠 {slots}
              {wheelchairUsers > slots && <b className="ml-1">（{wheelchairUsers - slots}名分不足：椅子への移乗が必要）</b>}
            </p>
          )
        })()}
        {(() => {
          const seatMap = new Map(
            lunchSeats.filter(a => byId.has(a.personId)).map(a => [`${a.tableId}:${a.seatIndex}`, byId.get(a.personId)!]),
          )
          return (
            // 配置図（幅 FLOOR_PLAN_WIDTH_PX）の縮小率は globals.css の .lunch-plan-zoom で指定
            // （画面のプレビューは A4縦の幅に合わせて縮小、印刷時は A4横の幅に合わせてほぼ等倍）
            <div className="lunch-plan-zoom overflow-hidden">
              <LunchFloorPlan tables={lunchTables} personAt={seat => seatMap.get(`${seat.tableId}:${seat.seatIndex}`) ?? null} />
            </div>
          )
        })()}
        <p className="mt-1 text-[11px] text-gray-600">♿ のピンクの点線は車椅子のまま座る席、⚠️ は車椅子枠と席の使い方が合っていない席です。</p>
      </Section>
      </div>
        ) },
        { key: 'transport', title: '送迎表', node: (title: string) => <TransportPrint title={title} data={transport} /> },
        { key: 'seating', title: '席レイアウト', landscape: true, node: (title: string) => <SeatingPrint title={title} data={seating} /> },
      ])}
    </div>
  )
}

// ===== 印刷するページの並べ方 =====

// 印刷の並び順（メニューの並び順とは別に固定。滋賀1泊旅行の印刷用まとめの順番を保つ）
const PRINT_ORDER = ['schedule', 'supplies', 'pickup', 'transport', 'bus', 'rooms', 'teams', 'bathing', 'banquet', 'lunch', 'seating']
// 同じ番号を使うページ（部屋割りと班分けは「⑤」でひとまとまり）
const SHARED_NUMBER: Record<string, string> = { teams: 'rooms' }
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

interface PrintSection {
  key: string
  title: string
  landscape?: boolean // A4 横向きのページ（名前付きページが切り替わるので、前後の改ページは自動）
  node: (title: string) => ReactNode
}

function arrangeSections(modules: string[], sections: PrintSection[]) {
  const list = sections
    .filter(s => modules.includes(s.key))
    .sort((a, b) => PRINT_ORDER.indexOf(a.key) - PRINT_ORDER.indexOf(b.key))
  if (list.length === 0) {
    return <p className="text-sm text-gray-600">このイベントで印刷できる機能が ON になっていません（管理画面の「イベント管理」で設定します）。</p>
  }
  const numbers = new Map<string, string>()
  let n = 0
  for (const s of list) {
    const shared = SHARED_NUMBER[s.key]
    numbers.set(s.key, shared && numbers.has(shared) ? numbers.get(shared)! : CIRCLED[n++] ?? `(${n})`)
  }
  return list.map((s, i) => {
    const next = list[i + 1]
    // 縦向きどうしの間だけ改ページを入れる（横向きページの前後は自動で改ページされる）
    const pageBreak = next && !s.landscape && !next.landscape
    return (
      <Fragment key={s.key}>
        {s.node(`${numbers.get(s.key)} ${s.title}`)}
        {pageBreak && <PageBreak />}
      </Fragment>
    )
  })
}

// ===== 送迎表（汎用）: 拠点ごとに枠を並べる =====
function TransportPrint({ title, data }: { title: string; data: TransportResponse | null }) {
  if (!data) return null
  const byId = new Map(data.persons.map(p => [p.id, p]))
  const membersOf = (slotId: number) =>
    data.assignments.filter(a => a.slotId === slotId && byId.has(a.personId)).map(a => byId.get(a.personId)!)
  const unassigned = data.persons.length - data.assignments.filter(a => byId.has(a.personId)).length
  return (
    <Section title={title}>
      {data.sections.length === 0 && <p className="text-[11px] text-gray-500">拠点がまだ登録されていません。</p>}
      <div className="space-y-3">
        {data.sections.map(sec => (
          <div key={sec.id} className="print-avoid-break">
            <h3 className="font-bold bg-gray-800 text-white px-2 py-1">
              {sec.name}
              {sec.time && `　🕗 ${sec.time}`}
            </h3>
            {sec.memo && <p className="text-[10px] mt-0.5 whitespace-pre-wrap">{sec.memo}</p>}
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {sec.slots.map(slot => {
                const members = membersOf(slot.id)
                const kind = slotKindOf(slot.kind)
                const over = slot.capacity !== null && members.length > slot.capacity
                return (
                  <Box
                    key={slot.id}
                    title={`${kind.icon} ${slot.name}${slot.capacity !== null ? `（定員：${slot.capacity}名）` : ''}`}
                    right={`${members.length}${slot.capacity !== null ? `/${slot.capacity}` : ''}名${over ? ' ⚠️超過' : ''}`}
                  >
                    {slot.memo && <p className="text-[10px] mb-1 whitespace-pre-wrap">📝 {slot.memo}</p>}
                    {members.length === 0 ? (
                      <p className="text-[10px] text-gray-400">（なし）</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {members.map(p => (
                          <li key={p.id} className={`border px-1.5 py-0.5 text-[11px] ${personColor(p)}`}>
                            <div className="truncate">{personLabel(p)}</div>
                            {p.pickupMemo && <div className="text-[9px] text-gray-700 whitespace-pre-wrap">{p.pickupMemo}</div>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Box>
                )
              })}
              {sec.slots.length === 0 && <p className="text-[10px] text-gray-400">（枠がありません）</p>}
            </div>
          </div>
        ))}
      </div>
      {unassigned > 0 && <p className="text-[10px] mt-2">※ まだ枠に割り当てられていない参加者が {unassigned}名 います（この表には表示していません）。</p>}
    </Section>
  )
}

// ===== 席レイアウト（汎用）: 配置図ごとに A4 横向き1枚。用紙の幅・高さに合わせて縮小する =====
// 画面のプレビューは A4 縦の印字幅（190mm ≒ 718px）、印刷は A4 横の印字幅 281mm ≒ 1062px・高さ 194mm ≒ 733px から見出し・注記の分（約150px）を引いた高さ
const PREVIEW_W = 718
const LANDSCAPE_W = 1062
const LANDSCAPE_H = 580

function SeatingPrint({ title, data }: { title: string; data: SeatingResponse | null }) {
  if (!data) return null
  const byId = new Map(data.persons.map(p => [p.id, p]))
  if (data.layouts.length === 0) {
    return (
      <div className="print-landscape-page">
        <Section title={title}>
          <p className="text-[11px] text-gray-500">配置図がまだ登録されていません。</p>
        </Section>
      </div>
    )
  }
  const wheelchairUsers = data.persons.filter(p => p.isWheelchair).length
  return (
    <>
      {data.layouts.map(layout => {
        const seatMap = new Map(
          data.assignments
            .filter(a => a.layoutId === layout.id && byId.has(a.personId))
            .map(a => [`${a.tableId}:${a.seatIndex}`, byId.get(a.personId)!]),
        )
        const personAt = (tableId: number, seatIndex: number) => seatMap.get(`${tableId}:${seatIndex}`) ?? null
        const seatedIds = new Set([...seatMap.values()].map(p => p.id))
        const slots = layout.tables.reduce((n, t) => n + Math.min(t.wheelchairSlots, t.seats), 0)
        const mismatches = layout.tables.reduce(
          (n, t) => n + Array.from({ length: t.seats }, (_, i) => personAt(t.id, i)).filter((p, i) => !!p && p.isWheelchair !== isWheelchairSeat(t, i)).length,
          0,
        )
        const notSeated: SeatPerson[] = data.persons.filter(p => !seatedIds.has(p.id))
        const printZoom = Math.min(1, LANDSCAPE_W / layout.width, LANDSCAPE_H / layout.height)
        return (
          <div key={layout.id} className="print-landscape-page">
            <Section title={`${title}　${layout.name}`}>
              <p className="text-[11px] mb-2">
                着席 {seatedIds.size}/{data.persons.length}名　♿ 車椅子利用 {wheelchairUsers}名 ／ 車椅子枠 {slots}
                {wheelchairUsers > slots && <b className="ml-1">（{wheelchairUsers - slots}名分不足）</b>}
                {mismatches > 0 && <b className="ml-1">⚠️ 車椅子枠と合っていない席 {mismatches}</b>}
              </p>
              <div className="print:hidden">
                <SeatingPlanStatic layout={layout} personAt={personAt} zoom={Math.min(1, PREVIEW_W / layout.width)} />
              </div>
              <div className="hidden print:block">
                <SeatingPlanStatic layout={layout} personAt={personAt} zoom={printZoom} />
              </div>
              {notSeated.length > 0 && (
                <p className="mt-1 text-[10px]">
                  席が決まっていない参加者（{notSeated.length}名）：{sortPersons(notSeated).map(p => p.name).join('、')}
                </p>
              )}
              <p className="mt-1 text-[10px] text-gray-600">ピンクの点線は車椅子枠の席、⚠️ は車椅子の方と席の種類が合っていない席です。</p>
            </Section>
          </div>
        )
      })}
    </>
  )
}

// ===== 表示用の部品 =====

const personColor = (p?: Pick<P, 'isWheelchair' | 'role'>) =>
  !p ? 'bg-white border-gray-300'
    : p.isWheelchair ? 'bg-pink-100 border-pink-400'
    : p.role === 'STAFF' ? 'bg-blue-100 border-blue-300'
    : 'bg-white border-gray-400'

const personLabel = (p: Pick<P, 'isWheelchair' | 'name' | 'isFishNG'>) => `${p.isWheelchair ? '♿' : ''}${p.name}${p.isFishNG ? '🐟❌' : ''}`

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold bg-gray-200 border-l-8 border-gray-800 border-b-2 border-b-gray-400 px-3 py-1.5 mb-3">{title}</h2>
      {children}
    </section>
  )
}

function SubHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`font-bold bg-gray-100 border-b-2 border-gray-400 px-2 py-1 mb-1.5 ${className}`}>{children}</h3>
  )
}

function PageBreak() {
  return <div className="break-after-page"></div>
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
      <span className="border px-1 bg-blue-100 border-blue-300">スタッフ</span>
      <span className="border px-1 bg-pink-100 border-pink-400">♿ 車椅子</span>
      <span className="border px-1 bg-white border-gray-400">利用者</span>
      <span>🐟❌ 魚料理NG</span>
    </div>
  )
}

function Box({ title, right, className = '', children }: {
  title: ReactNode
  right?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`break-inside-avoid border border-gray-500 print-avoid-break ${className}`}>
      <div className="flex justify-between gap-1 bg-gray-100 border-b border-gray-500 px-2 py-1 font-bold text-[11px]">
        <span className="min-w-0">{title}</span>
        {right && <span className="shrink-0">{right}</span>}
      </div>
      <div className="p-1.5">{children}</div>
    </div>
  )
}

function VehicleBox({ name, capacity, persons }: { name: string; capacity: number; persons: P[] }) {
  const over = persons.length > capacity
  return (
    <Box title={`🚗 ${name}（定員：${capacity}名）`} right={`${persons.length}/${capacity}名${over ? ' ⚠️超過' : ''}`}>
      <NameList persons={persons} />
    </Box>
  )
}

function NameList({ persons, leaderIds, banByPerson, columns = 1 }: {
  persons: P[]
  leaderIds?: Set<number>
  banByPerson?: Map<number, number | null>
  columns?: 1 | 2
}) {
  if (persons.length === 0) return <p className="text-[10px] text-gray-400">（なし）</p>
  return (
    <ul className={columns === 2 ? 'grid grid-cols-2 gap-0.5' : 'space-y-0.5'}>
      {persons.map(p => {
        const ban = banByPerson?.get(p.id)
        return (
          <li key={p.id} className={`border px-1.5 py-0.5 text-[11px] flex items-center gap-1 ${personColor(p)}`}>
            {leaderIds?.has(p.id) && <span>★</span>}
            <span className="flex-1 min-w-0 truncate">{personLabel(p)}</span>
            {ban && <span className="shrink-0 text-[10px] font-bold">{ban}班</span>}
          </li>
        )
      })}
    </ul>
  )
}

function BusSeat({ code, person }: { code: string; person?: P }) {
  return (
    <div className="flex h-8 min-w-0 overflow-hidden rounded border border-gray-300">
      <span className="w-7 shrink-0 border-r border-gray-300 bg-gray-100 text-[9px] text-gray-500 flex items-center justify-center">{code}</span>
      <span className={`flex-1 min-w-0 px-1 text-[11px] font-bold flex items-center ${person ? personColor(person) : 'bg-white'}`}>
        {person && <SeatPersonName person={person} />}
      </span>
    </div>
  )
}

// 狭い席のセル用の名前表示。♿・🐟❌ は必ず見えるように縮めず、名前（姓名の間は半角に詰める）だけ省略する
function SeatPersonName({ person }: { person: P }) {
  return (
    <>
      {person.isWheelchair && <span className="shrink-0">♿</span>}
      <span className="min-w-0 truncate">{person.name.replace(/　/g, ' ')}</span>
      {person.isFishNG && <span className="shrink-0 text-[8px]">🐟❌</span>}
    </>
  )
}

// 宴会の1テーブル。着席者の間にテーブル面を描き、同じテーブルの人がひと目でわかるようにする
function BanquetTable({ label, seats }: { label: string; seats: { seatId: string; person?: P }[] }) {
  const seated = seats.filter(s => s.person).length
  const top = seats.slice(0, 2)
  const bottom = seats.slice(2)
  const row = (list: typeof seats) => (
    <div className="grid grid-cols-2 gap-1">
      {list.map(({ seatId, person }) => (
        <div key={seatId} className={`h-7 min-w-0 rounded border px-1 flex items-center gap-1 ${personColor(person)}`}>
          <span className="shrink-0 text-[8px] text-gray-400">{seatId.split('-')[2]}</span>
          {person && <span className="flex-1 min-w-0 flex items-center text-[10px] font-bold"><SeatPersonName person={person} /></span>}
        </div>
      ))}
    </div>
  )
  return (
    <div className="rounded-lg border-2 border-amber-600/60 bg-amber-50 p-1.5 print-avoid-break">
      <div className="mb-1 flex justify-between text-[9px] font-bold text-amber-900">
        <span>{label}</span>
        <span>{seated}/{seats.length}名</span>
      </div>
      {row(top)}
      <div className="my-1 h-2 rounded-sm bg-amber-700/40" aria-hidden />
      {bottom.length > 0 && row(bottom)}
    </div>
  )
}

function CheckList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-[10px] text-gray-400">（なし）</p>
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span className="mt-0.5 inline-block w-3 h-3 shrink-0 border border-black" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th className={`border border-gray-500 px-2 py-1.5 text-left ${className}`}>{children}</th>
}

function Td({ children, className = '', colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`border border-gray-500 px-2 py-1.5 align-top ${className}`}>{children}</td>
}
