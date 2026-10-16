'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readMyPersonId, saveMyPersonId } from './myPerson'

interface Person {
  id: number
  name: string
  role: string
  participations?: { status: string }[]
}

// 「自分の担当」の名前選択。端末に記憶済みなら、そのまま自分の役割画面へ移動する（?select=1 のときは選び直し）
export default function StaffSelectPage() {
  const router = useRouter()
  const [persons, setPersons] = useState<Person[] | null>(null)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    const reselect = new URLSearchParams(window.location.search).has('select')
    const saved = readMyPersonId()
    if (!reselect && saved) {
      router.replace(`/staff/${saved}`)
      return
    }
    fetch('/api/persons?tripId=1')
      .then(res => res.json())
      .then((list: Person[]) => {
        setPersons(list.filter(p => p.participations?.[0]?.status === '参加'))
        if (saved) setSelected(String(saved))
      })
  }, [router])

  const open = () => {
    const id = Number(selected)
    if (!id) return
    saveMyPersonId(id)
    router.push(`/staff/${id}`)
  }

  const staff = persons?.filter(p => p.role === 'STAFF') ?? []
  const users = persons?.filter(p => p.role !== 'STAFF') ?? []

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">👤 自分の担当</h1>
        <p className="text-sm text-gray-500 mt-1">自分の名前を選ぶと、この端末に記憶されて次回から自動で開きます。</p>
      </div>

      {!persons ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">名前を選択</span>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="mt-1 w-full border-2 border-gray-300 rounded-xl px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">選択してください</option>
              <optgroup label="スタッフ">
                {staff.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
              <optgroup label="利用者">
                {users.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            </select>
          </label>
          <button
            type="button"
            onClick={open}
            disabled={!selected}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 disabled:opacity-40"
          >
            この名前で表示する
          </button>
        </div>
      )}
    </div>
  )
}
