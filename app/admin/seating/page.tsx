import SeatingBoard from '@/components/SeatingBoard'

export default function AdminSeatingPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🪑 席レイアウト (編集)</h1>
        <p className="text-sm text-gray-500 mt-1">
          🧩 配置モードでお店・会場の配置図（テーブル・入口・レジなど）を作り、👥 割り当てモードで参加者を席へ長押しのドラッグ＆ドロップで座らせます。
          ピンクの席は車椅子枠です。車椅子の方の席が合わないときは警告が出ます。
        </p>
      </div>
      <SeatingBoard editable />
    </div>
  )
}
