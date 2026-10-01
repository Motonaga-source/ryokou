'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DashboardData {
  trip: {
    name: string
    destination: string
    startDate: string
    endDate: string
    travelFee: number
    pocketMoney: number
  }
  stats: {
    totalParticipants: number
    totalStaff: number
    totalUsers: number
    vitalsDone: number
    vitalsTotal: number
    rooms: number
  }
}

const quickLinks = [
  { href: '/vitals', label: 'バイタルチェック', icon: '💊', color: 'bg-red-50 border-red-200 text-red-700', desc: '血圧・体温を記録' },
  { href: '/rooms', label: '部屋割り管理', icon: '🏨', color: 'bg-blue-50 border-blue-200 text-blue-700', desc: '入居者の確認・変更' },
  { href: '/medications', label: '服薬情報', icon: '💉', color: 'bg-purple-50 border-purple-200 text-purple-700', desc: '投薬内容の確認' },
  { href: '/teams', label: 'チーム・配置', icon: '📋', color: 'bg-green-50 border-green-200 text-green-700', desc: 'チーム編成・入浴担当' },
  { href: '/schedule', label: 'スケジュール', icon: '🗓️', color: 'bg-yellow-50 border-yellow-200 text-yellow-700', desc: '当日の流れを確認' },
  { href: '/pocket-money', label: '小遣い精算', icon: '💴', color: 'bg-orange-50 border-orange-200 text-orange-700', desc: '使用額・残額管理' },
]

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard?tripId=1')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-500 text-lg">読み込み中...</div>
      </div>
    )
  }

  const vitalsProgress = data
    ? Math.round((data.stats.vitalsDone / Math.max(data.stats.vitalsTotal, 1)) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          ✈️ {data?.trip.name || '旅行管理システム'}
        </h1>
        <p className="text-gray-500 mt-1">
          {data?.trip.destination} ／{' '}
          {data
            ? `${new Date(data.trip.startDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })} 〜 ${new Date(data.trip.endDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}`
            : ''}
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="参加者合計"
          value={data?.stats.totalParticipants ?? 0}
          unit="名"
          icon="👥"
          color="blue"
        />
        <StatCard
          label="利用者"
          value={data?.stats.totalUsers ?? 0}
          unit="名"
          icon="🧑"
          color="green"
        />
        <StatCard
          label="スタッフ"
          value={data?.stats.totalStaff ?? 0}
          unit="名"
          icon="👨‍💼"
          color="purple"
        />
        <StatCard
          label="客室数"
          value={data?.stats.rooms ?? 0}
          unit="室"
          icon="🏨"
          color="orange"
        />
      </div>

      {/* バイタルチェック進捗 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <span>💊</span> バイタルチェック進捗
          </h2>
          <Link href="/vitals" className="text-blue-600 text-sm hover:underline">
            記録する →
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-400 to-green-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${vitalsProgress}%` }}
              />
            </div>
          </div>
          <div className="text-sm text-gray-600 whitespace-nowrap">
            <span className="font-bold text-green-600">{data?.stats.vitalsDone ?? 0}</span>
            {' '}/ {data?.stats.vitalsTotal ?? 0}名 ({vitalsProgress}%)
          </div>
        </div>
      </div>

      {/* 旅費情報 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="text-gray-500 text-sm">旅費</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">
            ¥{(data?.trip.travelFee ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="text-gray-500 text-sm">小遣い支給額</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">
            ¥{(data?.trip.pocketMoney ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* クイックアクセス */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3">🚀 クイックアクセス</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`
                border-2 rounded-2xl p-4 flex flex-col gap-2
                transition-all duration-200 hover:scale-105 hover:shadow-md
                ${link.color}
              `}
            >
              <span className="text-3xl">{link.icon}</span>
              <span className="font-semibold text-sm">{link.label}</span>
              <span className="text-xs opacity-70">{link.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 重要な注意事項 */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
        <h2 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
          ⚠️ 重要な注意事項
        </h2>
        <ul className="space-y-2 text-sm text-amber-700">
          <li>🚫 <strong>アルコール提供NG</strong>：玉井様、仲様</li>
          <li>💊 <strong>眠前薬注意</strong>：アルコールを飲まれる方の眠前薬は中止</li>
          <li>🚢 <strong>船苦手な方</strong>：菅原様・山内様（松本さんが対応）</li>
          <li>🏨 <strong>夜間外出禁止</strong>：ホテルの外に出るのは禁止</li>
        </ul>
      </div>
    </div>
  )
}

function StatCard({
  label, value, unit, icon, color,
}: {
  label: string
  value: number
  unit: string
  icon: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  }
  return (
    <div className={`rounded-2xl border-2 p-4 ${colorMap[color]} shadow-sm`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-3xl font-bold">
        {value}<span className="text-base font-normal ml-1">{unit}</span>
      </div>
      <div className="text-xs mt-1 opacity-70">{label}</div>
    </div>
  )
}
