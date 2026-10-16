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
import PrintButton from './PrintButton'

export const metadata: Metadata = { title: '印刷用まとめ | 旅行管理システム' }

const TRIP_ID = 1
const DAY_NAMES = ['', '1日目（10/29・木）', '2日目（10/30・金）']
const BUS_ROWS = Array.from({ length: 12 }, (_, i) => 12 - i)

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
  const [trip, persons, schedules, supplies, vehicles, pickups, busSeats, cars, rooms, teams, bathing, banquet] =
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
            <div key={day} className="mb-4">
              <h3 className="font-bold mb-1">{DAY_NAMES[day]}</h3>
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
              <h3 className="font-bold bg-gray-800 text-white px-2 py-0.5">{loc.title}　🕗 {loc.time}</h3>
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
            <h3 className="font-bold bg-gray-800 text-white px-2 py-0.5">その他（個別対応・その他の送迎車）</h3>
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
        <h3 className="font-bold mb-1">大型バス（1号車）</h3>
        <table className="w-full border-collapse table-fixed text-[11px] print-avoid-break">
          <thead>
            <tr className="bg-gray-100">
              <Th className="w-8">列</Th>
              <Th>A</Th>
              <Th>B</Th>
              <Th className="w-4 !p-0" />
              <Th>C</Th>
              <Th>D</Th>
            </tr>
          </thead>
          <tbody>
            {BUS_ROWS.map(row => (
              <tr key={row} className="h-7">
                <Td className="text-center font-bold">{row}</Td>
                {row === 12 ? (
                  // 最後列は A〜E の5席
                  <Td colSpan={5} className="!p-0">
                    <div className="grid grid-cols-5 h-full">
                      {['A', 'B', 'C', 'D', 'E'].map(side => (
                        <div key={side} className="border-r last:border-r-0 border-gray-400 px-1 py-0.5 flex items-center gap-1">
                          <span className="text-[9px] text-gray-500">{side}</span>
                          <SeatName person={seatPerson(row, side)} />
                        </div>
                      ))}
                    </div>
                  </Td>
                ) : (
                  <>
                    <Td><SeatName person={seatPerson(row, 'A')} /></Td>
                    <Td><SeatName person={seatPerson(row, 'B')} /></Td>
                    <Td className="bg-gray-100 !p-0" />
                    <Td><SeatName person={seatPerson(row, 'C')} /></Td>
                    <Td><SeatName person={seatPerson(row, 'D')} /></Td>
                  </>
                )}
              </tr>
            ))}
            <tr>
              <Td colSpan={6} className="text-center font-bold bg-gray-100 tracking-[0.5em]">前方（運転席・乗降口）</Td>
            </tr>
          </tbody>
        </table>

        {cars.length > 0 && (
          <>
            <h3 className="font-bold mt-4 mb-1">乗用車（送迎・別働）</h3>
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
                title={`${room.roomNumber}号室（${room.floor}F・${room.roomType}）`}
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
        <div className="grid grid-cols-3 gap-2 text-[9px]">
          {BANQUET_COLUMNS.map(column => (
            <div key={column.key} className="border border-gray-500 p-1 space-y-1">
              <div className="text-center font-bold text-[10px]">{column.label}</div>
              {tablesOf(column.key).map(table => (
                <div key={table.key} className="border border-gray-400 bg-amber-50 p-0.5 print-avoid-break">
                  <div className="text-[8px] text-gray-600">{table.label}</div>
                  <div className="grid grid-cols-2 gap-0.5">
                    {table.seatIds.map(seatId => {
                      const p = banquetBySeat.get(seatId)
                      return (
                        <div key={seatId} className={`h-6 border px-0.5 flex items-center gap-0.5 overflow-hidden ${personColor(p)}`}>
                          <span className="text-[7px] text-gray-500 shrink-0">{seatId.split('-')[2]}</span>
                          {p && <span className="truncate font-bold">{personLabel(p)}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 bg-red-700 text-white text-center font-bold py-1 tracking-[1em]">舞台</div>
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
      <h2 className="text-base font-bold border-l-4 border-black pl-2 mb-2">{title}</h2>
      {children}
    </section>
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
      <div className="flex justify-between gap-1 bg-gray-100 border-b border-gray-500 px-1.5 py-0.5 font-bold text-[11px]">
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
          <li key={p.id} className={`border px-1 text-[11px] flex items-center gap-1 ${personColor(p)}`}>
            {leaderIds?.has(p.id) && <span>★</span>}
            <span className="flex-1 min-w-0 truncate">{personLabel(p)}</span>
            {ban && <span className="shrink-0 text-[10px] font-bold">{ban}班</span>}
          </li>
        )
      })}
    </ul>
  )
}

function SeatName({ person }: { person?: P }) {
  if (!person) return null
  return <span className={`inline-block max-w-full truncate border px-0.5 ${personColor(person)}`}>{personLabel(person)}</span>
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
  return <th className={`border border-gray-500 px-1.5 py-0.5 text-left ${className}`}>{children}</th>
}

function Td({ children, className = '', colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`border border-gray-500 px-1.5 py-0.5 align-top ${className}`}>{children}</td>
}
