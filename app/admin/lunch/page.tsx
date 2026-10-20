import LunchBoard from '@/components/LunchBoard'

export default function AdminLunchPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🍖 昼食 席順</h1>
        <p className="text-sm text-gray-500 mt-1">
          2日目 13:00 伊賀の里もくもく手づくりファーム。長押しで席（マス）へドラッグ＆ドロップします。座っている人の席に落とすと入れ替わります。♿ のピンクの枠は車椅子のまま座る席で、車椅子以外の方が座る・車椅子の方が普通の席に座ると警告が出ます（配置は可能）。
        </p>
      </div>
      <LunchBoard editable />
    </div>
  )
}
