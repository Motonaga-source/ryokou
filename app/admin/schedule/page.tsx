'use client'

import { useEffect, useState, useCallback } from 'react'

interface Schedule {
  id: number
  timeLabel: string
  location: string
  description: string | null
  assignedTo: string | null
  dayNo: number
  sortOrder: number
}

const DAY_COLORS = ['', 'from-blue-500 to-blue-700', 'from-green-500 to-green-700']
const DAY_NAMES = ['', '1日目（10/23・木）', '2日目（10/24・金）']

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState(1)

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/schedule?tripId=1')
    setSchedules(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  const daySchedules = schedules.filter((s) => s.dayNo === activeDay)

  const isImportant = (s: Schedule) =>
    s.timeLabel.includes('重要') || (s.description || '').includes('重要') || (s.description || '').includes('禁止')

  return (
    <div className="space-y-5">
      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🗓️ スケジュール</h1>
        <p className="text-gray-500 text-sm mt-1">旅行当日の流れと担当者</p>
      </div>

      {/* 日付切替 */}
      <div className="flex gap-2">
        {[1, 2].map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all ${
              activeDay === day
                ? `bg-gradient-to-r ${DAY_COLORS[day]} text-white shadow-lg`
                : 'bg-white border-2 border-gray-200 text-gray-600'
            }`}
          >
            {DAY_NAMES[day]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="relative">
          {/* タイムライン縦線 */}
          <div className="absolute left-[52px] top-0 bottom-0 w-0.5 bg-gray-200 md:left-[72px]" />

          <div className="space-y-4">
            {daySchedules.map((s, idx) => {
              const important = isImportant(s)
              return (
                <div key={s.id} className="flex gap-4 relative">
                  {/* 時刻 */}
                  <div className="w-14 shrink-0 text-right pt-3 md:w-20">
                    <span className={`text-xs font-bold leading-tight ${important ? 'text-red-600' : 'text-gray-500'}`}>
                      {s.timeLabel}
                    </span>
                  </div>

                  {/* ドット */}
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-3.5 z-10 ${
                    important ? 'bg-red-500 border-red-400' : 'bg-white border-blue-400'
                  }`} />

                  {/* カード */}
                  <div className={`flex-1 rounded-2xl p-4 shadow-sm border-2 mb-2 ${
                    important
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-gray-200'
                  }`}>
                    <h3 className={`font-bold text-sm ${important ? 'text-red-800' : 'text-gray-800'}`}>
                      {important && '⚠️ '}{s.location}
                    </h3>
                    {s.description && (
                      <p className={`text-xs mt-1.5 leading-relaxed ${important ? 'text-red-700' : 'text-gray-600'}`}>
                        {s.description}
                      </p>
                    )}
                    {s.assignedTo && (
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          👤 {s.assignedTo}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
