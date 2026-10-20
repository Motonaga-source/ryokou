import LunchBoard from '@/components/LunchBoard'

export default function LunchPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🍖 昼食 席順</h1>
        <p className="text-sm text-gray-500 mt-1">2日目 13:00 伊賀の里もくもく手づくりファームの席次です（閲覧専用）。♿ 点線の枠は車椅子のまま座る位置です。</p>
      </div>
      <LunchBoard />
    </div>
  )
}
