import LunchBoard from '@/components/LunchBoard'

export default function AdminLunchPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🍖 昼食 席順</h1>
        <p className="text-sm text-gray-500 mt-1">
          2日目 13:00 伊賀の里もくもく手づくりファーム。長押しでテーブルへドラッグ＆ドロップします。車椅子の方は車椅子枠（♿）から自動で座ります。定員や車椅子枠を超えると警告が出ます（割り当ては可能）。
        </p>
      </div>
      <LunchBoard editable />
    </div>
  )
}
