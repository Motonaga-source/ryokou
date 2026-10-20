// 入浴の枠内の小見出し（「担当スタッフ」「1班」「2班」…）。管理画面・一般画面・印刷で共通
const STYLES: Record<string, string> = {
  staff: 'bg-slate-600 text-white',
  'ban-1': 'bg-indigo-600 text-white',
  'ban-2': 'bg-emerald-600 text-white',
  'ban-3': 'bg-amber-500 text-white',
  'ban-none': 'bg-gray-300 text-gray-700',
}

export default function BanSectionLabel({ sectionKey, label, count }: { sectionKey: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold leading-none ${STYLES[sectionKey] ?? STYLES['ban-none']}`}>
        {label}
      </span>
      <span className="text-[11px] text-gray-500">{count}名</span>
      <span className="flex-1 border-t border-dashed border-black/15" aria-hidden />
    </div>
  )
}
