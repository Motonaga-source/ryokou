import TransportBoard from '@/components/TransportBoard'

export default function AdminTransportPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🚐 送迎表 (編集)</h1>
        <p className="text-sm text-gray-500 mt-1">
          拠点（集合場所・時刻）と、車・徒歩などの枠を作り、参加者を長押しのドラッグ＆ドロップで割り当てます。
          枠の中の人の上に落とすとその位置に入ります。定員を超えた枠は赤く表示されます。📝 でこのイベントの送迎メモを編集できます。
        </p>
      </div>
      <TransportBoard editable />
    </div>
  )
}
