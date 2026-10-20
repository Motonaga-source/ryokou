// 印刷専用まとめページ（閲覧・印刷専用）
// DnD は使わず、DB のデータをシンプルな div / table で A4 縦に並べる。未割り当ての人は表示しない
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { prisma } from '@/lib/prisma'
import { BATHING_ROLES, BATH_BADGES, sortPersons } from '@/lib/bathing'
import { BANQUET_COLUMNS, tablesOf } from '@/lib/banquet'
import { FAMILY_GROUP, OTHER_LOCATION, PICKUP_LOCATIONS, vehicleGroupId, walkGroupId } from '@/lib/pickup'
import { SUPPLY_CATEGORIES, WHEELCHAIR_LOAN } from '@/lib/supplies'
import { tablesByRow } from '@/lib/lunch'
import PrintButton from './PrintButton'

export const metadata: Metadata = { title: '印刷用まとめ | 旅行管理システム' }

const TRIP_ID = 1
const DAY_NAMES = ['', '1日目（10/29・木）', '2日目（10/30・金）']
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
  const [trip, persons, schedules, supplies, vehicles, pickups, busSeats, cars, rooms, teams, bathing, banquet, lunchTables, lunchSeats] =
    await Promise.all([
      prisma.trip.findUnique({ where: { id: TRIP_ID } }),
      prisma.person.findMany({
        where: { participations: { some: { tripId: TRIP_ID, status: '参加' } } },
        select: { id: true, name: true, role: true, gender: true, isWheelchair: true, isFishNG: true, wheelchairSource: true },
        orderBy: { id: 'asc' },
      }),
      prisma.schedule.findMany({ where: { tripId: TRIP_ID }, orderBy: [{ dayNo: 'asc' }, { sortOrder: 'asc' }] }),
      prisma.supplyItem.findMany({ where: { tripId: TRIP_ID }, orderBy: { id: 'asc' } }),
      prisma.pickupVehicle.findMany({ orderBy: { id: 'asc' } }),
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

  const dateLabel = trip
    ? `${trip.startDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' })} 〜 ${trip.endDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' })}`
    : ''

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

      {/* ① スケジュール */}
      <Section title="① スケジュール">
        {[1, 2].map(day => {
          const list = schedules.filter(s => s.dayNo === day)
          return (
            // 1日目と2日目は別の用紙に分ける
            <div key={day} className={day === 1 ? 'break-after-page' : ''}>
              <SubHeading>{DAY_NAMES[day]}</SubHeading>
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
      <PageBreak />

      {/* ② 持ち物リスト */}
      <Section title="② 持ち物リスト">
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
      <PageBreak />

      {/* ③ 集合・バス停への移動手段 */}
      <Section title="③ 集合・バス停への移動手段">
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
      <PageBreak />

      {/* ④ バス座席表 */}
      <Section title="④ バス座席表">
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
      <PageBreak />

      {/* ⑤ 部屋割り */}
      <Section title="⑤ 部屋割り">
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
      <PageBreak />

      {/* ⑤ 班分け（チーム・配置） */}
      <Section title="⑤ 班分け（チーム・配置）">
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
      <PageBreak />

      {/* ⑥ 入浴管理 */}
      <Section title="⑥ 入浴管理">
        <div className="grid grid-cols-2 gap-2">
          {BATHING_ROLES.map(role => {
            const members = pick(bathing.filter(b => b.role === role.value).map(b => b.personId))
              .map(p => ({ ...p, banNumber: banByPerson.get(p.id) ?? null }))
            const sorted = sortPersons(members)
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
                <NameList persons={sorted} banByPerson={banByPerson} />
              </Box>
            )
          })}
        </div>
      </Section>
      <PageBreak />

      {/* ⑦ 宴会 席順 */}
      <Section title="⑦ 宴会 席順">
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
      <PageBreak />

      {/* ⑧ 昼食 席順（テーブル単位） */}
      <Section title="⑧ 昼食 席順（2日目 13:00 伊賀の里もくもく手づくりファーム）">
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
        <div className="space-y-3">
          {tablesByRow(lunchTables).map((row, i) => (
            <div key={i}>
              <SubHeading>{i === 0 ? '奥の列' : '手前の列（レジカウンター側）'}</SubHeading>
              <div className="grid grid-cols-3 gap-2">
                {row.map(table => {
                  const members = pick(lunchSeats.filter(a => a.tableId === table.id).map(a => a.personId))
                  const wheelchair = members.filter(p => p.isWheelchair).length
                  const warn = members.length > table.capacity
                    ? '⚠️ 定員超過'
                    : wheelchair > table.wheelchairSlots ? '⚠️ 車椅子枠超過（移乗が必要）' : ''
                  return (
                    <Box key={table.id} title={`テーブル${table.tableNo}`} right={`${members.length}/${table.capacity}名`}>
                      <p className="text-[10px] text-gray-600 mb-1">
                        定員{table.capacity}{table.wheelchairSlots > 0 && `・♿枠${table.wheelchairSlots}`}
                        {warn && <b className="ml-1 text-black">{warn}</b>}
                      </p>
                      <NameList persons={members} />
                    </Box>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ===== 表示用の部品 =====

const personColor = (p?: P) =>
  !p ? 'bg-white border-gray-300'
    : p.isWheelchair ? 'bg-pink-100 border-pink-400'
    : p.role === 'STAFF' ? 'bg-blue-100 border-blue-300'
    : 'bg-white border-gray-400'

const personLabel = (p: P) => `${p.isWheelchair ? '♿' : ''}${p.name}${p.isFishNG ? '🐟❌' : ''}`

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
    <div className={`border border-gray-500 print-avoid-break ${className}`}>
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
