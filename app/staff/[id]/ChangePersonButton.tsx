'use client'

import { useRouter } from 'next/navigation'
import { clearMyPersonId } from '../myPerson'

export default function ChangePersonButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        clearMyPersonId()
        router.push('/staff?select=1')
      }}
      className="shrink-0 px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
    >
      🔁 別の名前を選び直す
    </button>
  )
}
