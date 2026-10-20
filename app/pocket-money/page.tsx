'use client'

import { useEffect, useState } from 'react'
import { ALLOWANCE_TYPES } from '@/lib/allowance'

interface PocketMoneyRecord {
  id: number
  allocated: number
  used: number
  remaining: number
  person: {
    id: number
    name: string
    gender: string | null
    facility: string | null
    isWheelchair: boolean
    allowanceManagementType: string | null
    allowanceRequiresCollection: boolean
  }
}

interface PocketMoneyData {
  records: PocketMoneyRecord[]
  total: { allocated: number; used: number; remaining: number }
}

// 管理区分ごとの列（チーム・配置画面と同じく、枠を横に並べる）。自己管理は法人のお金を扱わないため色を落とす
const COLUMNS = [
  { key: 'STAFF', icon: '🧑‍💼', frame: 'bg-blue-50 border-blue-300', header: 'bg-blue-600 text-white' },
  { key: 'USER', icon: '👛', frame: 'bg-emerald-50 border-emerald-300', header: 'bg-emerald-600 text-white' },
  { key: 'SELF', icon: '🏠', frame: 'bg-gray-50 border-gray-300', header: 'bg-gray-400 text-white' },
  { key: null, icon: '❔', frame: 'bg-white border-dashed border-gray-300', header: 'bg-gray-200 text-gray-700' },
] as const

const labelOf = (key: string | null) =>
  key === null ? '未設定' : key === 'SELF' ? '自己管理（法人準備なし）' : ALLOWANCE_TYPES.find(t => t.value === key)?.label ?? key

const yen = (n: number) => `¥${n.toLocaleString()}`

async function loadData(): Promise<PocketMoneyData> {
  const res = await fetch('/api/pocket-money?tripId=1')
  if (!res.ok) throw new Error('データ取得に失敗しました')
  return res.json()
}

// 小遣い精算（閲覧専用）。金額の入力や区分の設定は管理画面で行う
export default function PocketMoneyPage() {
  const [data, setData] = useState<PocketMoneyData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData().then(setData).catch(e => setError(e instanceof Error ? e.message : 'データ取得エラー'))
  }, [])

  const membersOf = (key: string | null) =>
    (data?.records ?? [])
      .filter(r => (r.person.allowanceManagementType ?? null) === key)
      .sort((a, b) => (a.person.facility ?? '').localeCompare(b.person.facility ?? '', 'ja') || a.person.id - b.person.id)

  const collectionCount = data?.records.filter(r => r.person.allowanceRequiresCollection).length ?? 0

  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">💴 小遣い精算</h1>
        <p className="text-gray-500 text-sm mt-1">管理区分ごとの利用者と、支給額・使用額・残額の一覧です（閲覧専用）。</p>
      </div>

      {/* 合計サマリー */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-3 text-center">
            <div className="text-xs text-blue-600 mb-1">支給合計</div>
            <div className="text-lg sm:text-xl font-bold text-blue-800 tabular-nums">{yen(data.total.allocated)}</div>
          </div>
          <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-3 text-center">
            <div className="text-xs text-orange-600 mb-1">使用合計</div>
            <div className="text-lg sm:text-xl font-bold text-orange-800 tabular-nums">{yen(data.total.used)}</div>
          </div>
          <div className="bg-green-50 rounded-2xl border-2 border-green-200 p-3 text-center">
            <div className="text-xs text-green-600 mb-1">残金合計</div>
            <div className="text-lg sm:text-xl font-bold text-green-800 tabular-nums">{yen(data.total.remaining)}</div>
          </div>
        </div>
      )}

      {data && collectionCount > 0 && (
        <p className="text-sm">
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-3 py-1 font-semibold text-orange-800">
            ⚠️ レシート・お釣りの回収が必要な方 {collectionCount}名
          </span>
        </p>
      )}

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-center">⚠ {error}</div>
      ) : !data ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        // スマホは1列、タブレットは2列、PCは4列に並べる
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {COLUMNS.map(col => {
            const members = membersOf(col.key)
            if (col.key === null && members.length === 0) return null
            // 人数の多い区分は2列ぶんの幅を使い、カードも2列に並べて縦のスクロールを減らす
            const wide = members.length > 12
            return (
              <section key={col.key ?? 'none'} className={`rounded-2xl border-4 overflow-hidden shadow-sm ${col.frame} ${wide ? 'sm:col-span-2' : ''}`}>
                <div className={`px-4 py-2.5 flex items-center justify-between gap-2 ${col.header}`}>
                  <h2 className="font-bold min-w-0">{col.icon} {labelOf(col.key)}</h2>
                  <span className="shrink-0 text-sm font-bold">{members.length}名</span>
                </div>
                <div className={`p-3 gap-2 min-h-[80px] ${wide ? 'grid grid-cols-1 sm:grid-cols-2' : 'flex flex-col'}`}>
                  {members.map(r => <MoneyCard key={r.person.id} record={r} self={col.key === 'SELF'} />)}
                  {members.length === 0 && <p className="text-sm text-gray-400 text-center py-3">該当する方はいません</p>}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MoneyCard({ record, self }: { record: PocketMoneyRecord; self: boolean }) {
  const { person } = record
  const rate = record.allocated > 0 ? Math.round((record.used / record.allocated) * 100) : 0

  return (
    <div className={`print-avoid-break rounded-xl border-2 p-3 ${
      self ? 'bg-gray-100/70 border-gray-200' : person.isWheelchair ? 'bg-white border-pink-300' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-base font-bold leading-snug ${self ? 'text-gray-500' : 'text-gray-900'}`}>
            {person.isWheelchair && <span className="mr-0.5 text-sm">♿️</span>}
            {person.name}
          </div>
          {person.facility && <div className="text-[11px] text-gray-400">{person.facility}</div>}
        </div>
      </div>

      {person.allowanceRequiresCollection && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-orange-300 bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800">
          ⚠️ レシート・お釣り回収あり
        </div>
      )}

      {self ? (
        <p className="mt-2 text-xs text-gray-500">法人準備なし（本人が用意したお金のため精算対象外）</p>
      ) : (
        <>
          {/* 金額は横一列・右寄せにしてカードの高さを抑える */}
          <dl className="mt-1.5 grid grid-cols-3 gap-1 text-right tabular-nums">
            <div><dt className="text-[10px] text-gray-500">支給</dt><dd className="text-sm font-semibold text-gray-700">{yen(record.allocated)}</dd></div>
            <div><dt className="text-[10px] text-orange-600">使用</dt><dd className="text-sm font-semibold text-orange-700">{yen(record.used)}</dd></div>
            <div>
              <dt className="text-[10px] text-green-600">残金</dt>
              <dd className={`text-sm font-bold ${record.remaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>{yen(record.remaining)}</dd>
            </div>
          </dl>
          <div className="mt-1.5 h-1.5 rounded-full bg-gray-100">
            <div
              className={`h-1.5 rounded-full ${rate >= 100 ? 'bg-red-500' : rate >= 80 ? 'bg-orange-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(rate, 100)}%` }}
            />
          </div>
        </>
      )}
    </div>
  )
}
