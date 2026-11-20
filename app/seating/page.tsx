import SeatingBoard from '@/components/SeatingBoard'

export default function SeatingPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🪑 席レイアウト</h1>
        <p className="text-sm text-gray-500 mt-1">配置図ごとの席順です（閲覧専用）。ピンクの席は車椅子枠です。</p>
      </div>
      <SeatingBoard />
    </div>
  )
}
