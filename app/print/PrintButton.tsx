'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden fixed top-4 right-4 z-50 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg hover:bg-blue-700"
    >
      🖨️ このページを印刷する
    </button>
  )
}
