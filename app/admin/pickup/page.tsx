import PickupBoard from '@/components/PickupBoard'

export default function AdminPickupPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🚗 集合・送迎</h1>
        <p className="text-sm text-gray-500 mt-1">
          各施設からバス停（湯里 → グレイス → 瓜破西）までの移動手段を、長押しのドラッグ＆ドロップで割り当てます。定員を超えた送迎車は赤く表示されます。送迎メモは参加者名簿で編集できます。
        </p>
      </div>
      <PickupBoard editable />
    </div>
  )
}
