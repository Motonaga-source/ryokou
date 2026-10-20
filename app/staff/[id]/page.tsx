// スタッフ別ページ（個人の役割まとめ・閲覧専用）。スマホで見やすいカードを縦に並べる
export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { BATHING_ROLES, BATH_BADGES, sectionsByBan, sortPersons } from '@/lib/bathing'
import { BANQUET_COLUMNS, tablesOf } from '@/lib/banquet'
import { FAMILY_GROUP, OTHER_LOCATION, PICKUP_LOCATIONS, vehicleIdOf, walkGroupId } from '@/lib/pickup'
import FishNGBadge from '@/components/FishNGBadge'
import BanSectionLabel from '@/components/BanSectionLabel'
import ChangePersonButton from './ChangePersonButton'

const TRIP_ID = 1
const DAY_NAMES = ['', '1日目（10/29・木）', '2日目（10/30・金）']
// バスで隣に座る席（最後列 12 は A〜E が横一列）
const BUS_NEIGHBORS: Record<string, string[]> = { A: ['B'], B: ['A'], C: ['D'], D: ['C'] }
const BACK_ROW_SIDES = ['A', 'B', 'C', 'D', 'E']

// 部屋番号が数字だけのときだけ「号室」を付ける（"363トリプルベッド" のような名前はそのまま）
const roomLabel = (roomNumber: string) => (/^\d+$/.test(roomNumber.trim()) ? `${roomNumber}号室` : roomNumber)

interface P {
  id: number
  name: string
  role: string
  gender: string | null
  isWheelchair: boolean
  isFishNG: boolean
}

export default async function StaffRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const personId = parseInt(id)

  const persons = await prisma.person.findMany({
    where: { participations: { some: { tripId: TRIP_ID, status: '参加' } } },
    select: { id: true, name: true, role: true, gender: true, isWheelchair: true, isFishNG: true },
  })
  const byId = new Map(persons.map(p => [p.id, p]))
  const me = byId.get(personId)

  if (!me) {
    return (
      <div className="max-w-md mx-auto space-y-4 pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">👤 自分の担当</h1>
        <p className="text-sm text-gray-600 bg-white border-2 border-gray-200 rounded-2xl p-4">
          この参加者は見つからないか、今回の旅行に「参加」になっていません。名前を選び直してください。
        </p>
        <ChangePersonButton />
      </div>
    )
  }

  const [pickup, vehicles, busSeat, carAssignments, roomAssignments, teamMemberships, bathing, banquetSeat, schedules, lunchSeat] =
    await Promise.all([
      prisma.pickupAssignment.findUnique({ where: { tripId_personId: { tripId: TRIP_ID, personId } } }),
      prisma.pickupVehicle.findMany(),
      prisma.busSeatAssignment.findUnique({ where: { tripId_personId: { tripId: TRIP_ID, personId } } }),
      prisma.carAssignment.findMany({
        where: { personId, car: { tripId: TRIP_ID } },
        include: { car: { include: { assignments: true } } },
      }),
      prisma.roomAssignment.findMany({
        where: { personId, room: { tripId: TRIP_ID } },
        include: { room: { include: { assignments: true } } },
      }),
      prisma.teamMember.findMany({
        where: { personId, team: { tripId: TRIP_ID } },
        include: { team: { include: { members: true } } },
      }),
      prisma.bathingAssignment.findUnique({ where: { tripId_personId: { tripId: TRIP_ID, personId } } }),
      prisma.banquetSeatAssignment.findUnique({ where: { tripId_personId: { tripId: TRIP_ID, personId } } }),
      prisma.schedule.findMany({ where: { tripId: TRIP_ID }, orderBy: [{ dayNo: 'asc' }, { sortOrder: 'asc' }] }),
      prisma.lunchSeatAssignment.findUnique({
        where: { tripId_personId: { tripId: TRIP_ID, personId } },
        include: { table: { include: { assignments: true } } },
      }),
    ])

  const pick = (ids: number[]) => sortPersons(ids.map(i => byId.get(i)).filter((p): p is P => !!p))

  // ===== 集合・送迎 =====
  let pickupInfo: { area: string; method: string; members: P[] } | null = null
  if (pickup) {
    const sameGroup = await prisma.pickupAssignment.findMany({ where: { tripId: TRIP_ID, groupId: pickup.groupId } })
    const members = pick(sameGroup.map(a => a.personId))
    const walk = PICKUP_LOCATIONS.find(l => walkGroupId(l.id) === pickup.groupId)
    const vehicleId = vehicleIdOf(pickup.groupId)
    const vehicle = vehicleId !== null ? vehicles.find(v => v.id === vehicleId) : undefined
    const areaOf = (location: string) => {
      const loc = PICKUP_LOCATIONS.find(l => l.id === location)
      return loc ? `${loc.title}（${loc.time}）` : OTHER_LOCATION.label
    }
    if (walk) pickupInfo = { area: areaOf(walk.id), method: '🚶 徒歩でバス停へ移動', members }
    else if (vehicle) pickupInfo = { area: areaOf(vehicle.location), method: `🚗 送迎車「${vehicle.name}」（定員${vehicle.capacity}名）`, members }
    else if (pickup.groupId === FAMILY_GROUP.id) pickupInfo = { area: OTHER_LOCATION.label, method: `${FAMILY_GROUP.icon} ${FAMILY_GROUP.label}`, members }
  }

  // ===== バス座席 =====
  let busInfo: { seat: string; neighbors: P[] } | null = null
  if (busSeat?.rowNo && busSeat.seatSide) {
    const row = busSeat.rowNo
    const side = busSeat.seatSide
    const neighborSides = row === 12
      ? BACK_ROW_SIDES.filter((_, i, arr) => Math.abs(i - arr.indexOf(side)) === 1)
      : BUS_NEIGHBORS[side] ?? []
    const neighborSeats = await prisma.busSeatAssignment.findMany({
      where: { tripId: TRIP_ID, vehicle: busSeat.vehicle, rowNo: row, seatSide: { in: neighborSides } },
    })
    busInfo = {
      seat: `${busSeat.vehicle ? `${busSeat.vehicle}・` : ''}${row}列 ${side}席`,
      neighbors: pick(neighborSeats.map(s => s.personId)),
    }
  }

  // ===== 宴会 =====
  let banquetInfo: { label: string; members: P[] } | null = null
  if (banquetSeat) {
    for (const column of BANQUET_COLUMNS) {
      const table = tablesOf(column.key).find(t => t.seatIds.includes(banquetSeat.seatId))
      if (!table) continue
      const tableSeats = await prisma.banquetSeatAssignment.findMany({
        where: { tripId: TRIP_ID, seatId: { in: table.seatIds } },
      })
      banquetInfo = {
        label: `${column.label} ${table.label}（席番号 ${banquetSeat.seatId.split('-')[2]}）`,
        members: pick(tableSeats.map(s => s.personId)),
      }
    }
  }

  // ===== 入浴 =====
  // スタッフは班に関係なく最初から最後まで担当するため、担当する湯（男湯・女湯）に来る全ての班の利用者を表示する。
  // 男湯・女湯の役割（大浴場・脱衣所サポート・送迎・誘導）は同じ湯の利用者全員、部屋風呂・自立入浴は同じ役割の利用者が対象
  let bathingInfo: {
    role: (typeof BATHING_ROLES)[number]
    ban: number | null
    sameBan: P[] // 利用者: 同じ班の利用者
    users: (P & { banNumber: number | null })[] // スタッフ: 担当する利用者（全ての班）
    staff: { person: P; roleLabel: string }[] // 同じ湯（または同じ役割）を担当するスタッフ
  } | null = null
  const bathingRole = BATHING_ROLES.find(r => r.value === bathing?.role)
  if (bathing && bathingRole) {
    const all = await prisma.bathingAssignment.findMany({ where: { tripId: TRIP_ID, role: { not: null } } })
    const roleOf = (value: string | null) => BATHING_ROLES.find(r => r.value === value)
    const inScope = (value: string | null) => {
      const r = roleOf(value)
      return !!r && (bathingRole.bath ? r.bath === bathingRole.bath : r.value === bathingRole.value)
    }
    const scoped = all.filter(a => inScope(a.role) && byId.has(a.personId))
    const banOf = new Map(all.map(a => [a.personId, a.banNumber]))
    bathingInfo = {
      role: bathingRole,
      ban: me.role === 'STAFF' ? null : bathing.banNumber,
      sameBan: pick(all.filter(a => a.role === bathing.role && a.banNumber === bathing.banNumber && byId.get(a.personId)?.role !== 'STAFF').map(a => a.personId)),
      users: sortPersons(
        scoped.filter(a => byId.get(a.personId)?.role !== 'STAFF').map(a => ({ ...byId.get(a.personId)!, banNumber: banOf.get(a.personId) ?? null })),
      ),
      staff: pick(scoped.filter(a => byId.get(a.personId)?.role === 'STAFF').map(a => a.personId)).map(person => ({
        person,
        roleLabel: roleOf(scoped.find(a => a.personId === person.id)?.role ?? null)?.baseLabel ?? '',
      })),
    }
  }

  // ===== スケジュール（担当者欄に自分の名前・姓・「全員」が含まれる予定） =====
  const compact = (s: string) => s.replace(/[\s　]/g, '')
  const fullName = compact(me.name)
  const surname = me.name.split(/[\s　]/)[0]
  const mySchedules = schedules.filter(s => {
    if (!s.assignedTo) return false
    const assigned = compact(s.assignedTo)
    return assigned.includes(fullName) || (surname.length >= 2 && assigned.includes(surname)) || assigned.includes('全員')
  })

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="pt-12 lg:pt-0 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">👤 自分の担当</p>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-1.5">
            {me.isWheelchair && <span className="text-xl">♿️</span>}
            <span className="min-w-0 break-words">{me.name}</span>
            {me.isFishNG && <FishNGBadge />}
          </h1>
          <p className="text-xs text-gray-500">{me.role === 'STAFF' ? 'スタッフ' : '利用者'}</p>
        </div>
        <ChangePersonButton />
      </div>

      <Card icon="🚗" title="集合・送迎" href="/pickup" linkLabel="送迎を見る">
        {pickupInfo ? (
          <>
            <Main>{pickupInfo.method}</Main>
            <Sub>{pickupInfo.area}</Sub>
            <Members label="一緒に移動する人" persons={pickupInfo.members} meId={me.id} />
          </>
        ) : <Undecided />}
      </Card>

      <Card icon="🚌" title="バス座席" href="/bus" linkLabel="座席表を見る">
        {busInfo ? (
          <>
            <Main>{busInfo.seat}</Main>
            <Members label="隣に座る人" persons={busInfo.neighbors} meId={me.id} empty="隣は空席です" />
          </>
        ) : carAssignments.length === 0 && <Undecided />}
        {carAssignments.map(a => (
          <div key={a.id} className={busInfo ? 'mt-3 pt-3 border-t border-gray-100' : ''}>
            <Main>🚙 乗用車「{a.car.name}」（定員{a.car.capacity}名）</Main>
            <Members label="同乗する人" persons={pick(a.car.assignments.map(x => x.personId))} meId={me.id} />
          </div>
        ))}
      </Card>

      <Card icon="🏨" title="部屋" href="/rooms" linkLabel="部屋割りを見る">
        {roomAssignments.length === 0 && <Undecided />}
        {roomAssignments.map(a => (
          <div key={a.id}>
            <Main>{roomLabel(a.room.roomNumber)}</Main>
            <Sub>{a.room.floor}階・{a.room.roomType}</Sub>
            <Members label="同室のメンバー" persons={pick(a.room.assignments.map(x => x.personId))} meId={me.id} />
          </div>
        ))}
      </Card>

      <Card icon="📋" title="チーム" href="/teams" linkLabel="チームを見る">
        {teamMemberships.length === 0 && <Undecided />}
        {teamMemberships.map(m => {
          const leaderIds = new Set(m.team.members.filter(x => x.isLeader).map(x => x.personId))
          return (
            <div key={m.id}>
              <Main>
                {m.team.name}
                {m.isLeader && <span className="ml-2 align-middle text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-2 py-0.5">★ リーダー</span>}
              </Main>
              <Members label="同じチームのメンバー" persons={pick(m.team.members.map(x => x.personId))} meId={me.id} leaderIds={leaderIds} />
            </div>
          )
        })}
      </Card>

      <Card icon="♨️" title="入浴" href="/bathing" linkLabel="入浴管理を見る">
        {bathingInfo ? (
          <>
            <Main>
              {bathingInfo.role.icon} {bathingInfo.role.baseLabel}
              {bathingInfo.role.bath && (
                <span className={`ml-2 align-middle text-xs font-bold rounded px-1.5 py-0.5 ${BATH_BADGES[bathingInfo.role.bath].className}`}>
                  {BATH_BADGES[bathingInfo.role.bath].label}
                </span>
              )}
              {me.role === 'STAFF' ? (
                <span className="ml-2 align-middle text-xs font-bold rounded px-1.5 py-0.5 bg-slate-600 text-white">担当（全ての班）</span>
              ) : (
                <span className="ml-2 align-middle text-sm font-bold text-indigo-700">{bathingInfo.ban ? `${bathingInfo.ban}班` : '班は未設定'}</span>
              )}
            </Main>
            {me.role === 'STAFF' ? (
              <>
                <Sub>
                  {bathingInfo.role.bath
                    ? `${BATH_BADGES[bathingInfo.role.bath].label}に来る全ての利用者を、入浴の順番（班）ごとに表示しています。`
                    : `${bathingInfo.role.baseLabel}の全ての利用者を、入浴の順番（班）ごとに表示しています。`}
                </Sub>
                <BanSections users={bathingInfo.users} />
              </>
            ) : (
              <Members label={bathingInfo.ban ? `同じ班（${bathingInfo.ban}班）の利用者` : '同じ役割の利用者'} persons={bathingInfo.sameBan} meId={me.id} />
            )}
            <StaffList
              label={me.role === 'STAFF' ? '一緒に担当するスタッフ' : '担当スタッフ'}
              staff={bathingInfo.staff.filter(s => s.person.id !== me.id)}
            />
          </>
        ) : <Undecided />}
      </Card>

      <Card icon="🍶" title="宴会" href="/banquet" linkLabel="席順を見る">
        {banquetInfo ? (
          <>
            <Main>{banquetInfo.label}</Main>
            <Members label="同じテーブルのメンバー" persons={banquetInfo.members} meId={me.id} />
          </>
        ) : <Undecided />}
      </Card>

      <Card icon="🍖" title="昼食（2日目 もくもく手づくりファーム）" href="/lunch" linkLabel="席順を見る">
        {lunchSeat ? (
          <>
            <Main>
              テーブル{lunchSeat.table.tableNo}
              {me.isWheelchair && lunchSeat.seatIndex >= lunchSeat.table.wheelchairSlots && (
                <span className="ml-2 align-middle text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300 rounded-full px-2 py-0.5">⚠️ 椅子への移乗が必要</span>
              )}
            </Main>
            <Sub>
              {lunchSeat.seatIndex < lunchSeat.table.wheelchairSlots ? '♿ 車椅子枠の席' : '普通の席'}
              ・定員{lunchSeat.table.capacity}名{lunchSeat.table.wheelchairSlots > 0 && `（車椅子枠${lunchSeat.table.wheelchairSlots}）`}
            </Sub>
            <Members label="同じテーブルのメンバー" persons={pick(lunchSeat.table.assignments.map(a => a.personId))} meId={me.id} />
          </>
        ) : <Undecided />}
      </Card>

      <Card icon="🗓️" title="スケジュール（自分の担当）" href="/schedule" linkLabel="全体を見る">
        {mySchedules.length === 0 ? (
          <p className="text-sm text-gray-500">担当者に名前が入っている予定はありません。</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {mySchedules.map(s => (
              <li key={s.id} className="py-2 flex gap-3">
                <div className="shrink-0 w-20 text-xs text-gray-500">
                  <div>{DAY_NAMES[s.dayNo]?.slice(0, 3)}</div>
                  <div className="text-sm font-bold text-gray-800">{s.timeLabel}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-800">{s.location}</div>
                  {s.description && <div className="text-xs text-gray-600 whitespace-pre-wrap mt-0.5">{s.description}</div>}
                  <div className="text-xs text-blue-600 mt-0.5">👤 {s.assignedTo}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

// href を渡すと、ヘッダー右上に全体画面（一般向けの閲覧ページ）へのショートカットを表示する
function Card({ icon, title, href, linkLabel = '全体を見る', children }: {
  icon: string
  title: string
  href?: string
  linkLabel?: string
  children: ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b-2 border-gray-100 flex items-center justify-between gap-2">
        <h2 className="min-w-0 font-bold text-gray-800">{icon} {title}</h2>
        {href && (
          <Link
            href={href}
            className="shrink-0 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 active:bg-blue-100"
          >
            <span aria-hidden>↗</span>
            {linkLabel}
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Main({ children }: { children: ReactNode }) {
  return <p className="text-lg font-bold text-gray-900 leading-snug">{children}</p>
}

function Sub({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-600 mt-0.5">{children}</p>
}

function Undecided() {
  return <p className="text-sm text-gray-400">未定（まだ割り当てられていません）</p>
}

// スタッフ向け: 担当する利用者を班（入浴の順番）ごとに表示
function BanSections({ users }: { users: (P & { banNumber: number | null })[] }) {
  if (users.length === 0) return <p className="mt-3 text-sm text-gray-400">担当する利用者はまだ割り当てられていません。</p>
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs font-semibold text-gray-500">担当する利用者（全ての班・{users.length}名）</p>
      {sectionsByBan(users).map(sec => (
        <div key={sec.key} className="space-y-1.5">
          <BanSectionLabel sectionKey={sec.key} label={sec.label} count={sec.persons.length} />
          <div className="flex flex-wrap gap-1.5">
            {sec.persons.map(p => <NameChip key={p.id} person={p} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function StaffList({ label, staff }: { label: string; staff: { person: P; roleLabel: string }[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}（{staff.length}名）</p>
      {staff.length === 0 ? (
        <p className="text-sm text-gray-400">まだ割り当てられていません</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {staff.map(({ person, roleLabel }) => (
            <span key={person.id} className="inline-flex flex-col">
              <NameChip person={person} />
              <span className="text-[10px] text-gray-500 pl-1">{roleLabel}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function NameChip({ person: p }: { person: P }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border-2 px-2 py-1 text-sm font-semibold text-gray-800 ${
        p.isWheelchair ? 'bg-pink-100 border-pink-400' : p.role === 'STAFF' ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-300'
      }`}
    >
      {p.isWheelchair && <span className="text-xs">♿️</span>}
      {p.name}
      {p.isFishNG && <FishNGBadge />}
    </span>
  )
}

function Members({ label, persons, meId, leaderIds, empty }: {
  label: string
  persons: P[]
  meId: number
  leaderIds?: Set<number>
  empty?: string
}) {
  const others = persons.filter(p => p.id !== meId)
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}（{others.length}名）</p>
      {others.length === 0 ? (
        <p className="text-sm text-gray-400">{empty ?? '自分のみです'}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {others.map(p => (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1 rounded-lg border-2 px-2 py-1 text-sm font-semibold text-gray-800 ${
                p.isWheelchair ? 'bg-pink-100 border-pink-400' : p.role === 'STAFF' ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-300'
              }`}
            >
              {leaderIds?.has(p.id) && <span className="text-amber-600">★</span>}
              {p.isWheelchair && <span className="text-xs">♿️</span>}
              {p.name}
              {p.isFishNG && <FishNGBadge />}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
