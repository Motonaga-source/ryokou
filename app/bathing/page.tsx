'use client'

import { useEffect, useState } from 'react'
import BathingPersonCard from '@/components/BathingPersonCard'
import {
  BATHING_ROLES,
  BATH_BADGES,
  buildBathingBoard,
  type BathingBoard,
  type BathingPerson,
} from '@/lib/bathing'

export default function BathingPage() {
  const [groups, setGroups] = useState<BathingBoard | null>(null)
  const [unassigned, setUnassigned] = useState<BathingPerson[]>([])

  useEffect(() => {
    (async () => {
      const [resA, resP] = await Promise.all([
        fetch('/api/bathing?tripId=1'),
        fetch('/api/persons?tripId=1'),
      ])
      const board = buildBathingBoard(await resP.json(), await resA.json())
      setGroups(board.groups)
      setUnassigned(board.unassigned)
    })()
  }, [])

  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">♨️ 入浴管理</h1>
        <p className="text-sm text-gray-500">入浴の役割・配置の一覧です（閲覧専用）。</p>
      </div>

      {!groups ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-6 items-start">

          {/* 左カラム: 未割り当て（スタッフ） */}
          <div className="w-full xl:w-56 shrink-0 order-2 xl:order-1 print:hidden">
            <UnassignedList persons={unassigned} role="STAFF" title="スタッフ" />
          </div>

          {/* 中央カラム: 入浴グループ（男湯・女湯を左右に並べる） */}
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 order-1 xl:order-2 print:w-full">
            {BATHING_ROLES.map(r => (
              <GroupCard key={r.value} group={r} persons={groups[r.value]} />
            ))}
          </div>

          {/* 右カラム: 未割り当て（利用者） */}
          <div className="w-full xl:w-56 shrink-0 order-3 xl:order-3 print:hidden">
            <UnassignedList persons={unassigned} role="USER" title="利用者" />
          </div>

        </div>
      )}
    </div>
  )
}

function GroupCard({ group, persons }: { group: (typeof BATHING_ROLES)[number], persons: BathingPerson[] }) {
  const wheelchairCount = persons.filter(p => p.isWheelchair).length
  const staffCount = persons.filter(p => p.role === 'STAFF').length

  return (
    <div className={`print-avoid-break rounded-2xl border-4 overflow-hidden shadow-sm ${group.colorClass}`}>
      <div className="px-4 py-3 md:py-2 bg-white/50 border-b-2 border-black/10">
        <div className="font-bold text-base text-gray-800 flex justify-between items-center gap-2">
          <span className="min-w-0 flex items-center gap-1.5">
            <span className="truncate">{group.icon} {group.baseLabel}</span>
            {group.bath && (
              <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-xs font-bold ${BATH_BADGES[group.bath].className}`}>
                {BATH_BADGES[group.bath].label}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2 text-sm font-medium opacity-80 shrink-0">
            {wheelchairCount > 0 && (
              <span className="bg-pink-200 text-pink-800 px-1.5 py-0.5 rounded-full text-xs">
                ♿️ {wheelchairCount}
              </span>
            )}
            <span>{persons.length}名</span>
          </div>
        </div>
        <p className="text-xs text-gray-600">{group.description}（スタッフ{staffCount}名）</p>
      </div>
      <div className="min-h-[140px] p-3 flex flex-col gap-2">
        {persons.map(p => (
          <BathingPersonCard key={p.id} person={p} banMode="label" />
        ))}
      </div>
    </div>
  )
}

function UnassignedList({ persons, role, title }: { persons: BathingPerson[], role: string, title: string }) {
  const filtered = persons.filter(p => p.role === role)

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-4" style={{ minHeight: '300px' }}>
      <h3 className="font-bold text-gray-800 mb-3">未割り当て ({title}) - {filtered.length}名</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-1 gap-3 max-h-[400px] xl:max-h-[600px] overflow-y-auto pr-1">
        {filtered.map(p => (
          <BathingPersonCard key={p.id} person={p} />
        ))}
      </div>
    </div>
  )
}
