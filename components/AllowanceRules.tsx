'use client'

import { useEffect, useState } from 'react'
import { ALLOWANCE_TYPES, canRequireCollection, type AllowanceRule } from '@/lib/allowance'

// 小遣いの事前ルール設定（管理区分 3択 と 事後回収の要否）。変更はその場で保存する
// 当日の受け渡しチェックなどは扱わない（他画面のカードにも表示しない）
export default function AllowanceRules() {
  const [rules, setRules] = useState<AllowanceRule[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/pocket-money/rules?tripId=1')
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '読み込みに失敗しました')
        return res.json()
      })
      .then(setRules)
      .catch(e => setError(e instanceof Error ? e.message : '読み込みに失敗しました'))
  }, [])

  const save = async (rule: AllowanceRule, patch: Partial<Pick<AllowanceRule, 'allowanceManagementType' | 'allowanceRequiresCollection'>>) => {
    const next = { ...rule, ...patch }
    if (!canRequireCollection(next.allowanceManagementType)) next.allowanceRequiresCollection = false
    setRules(list => list && list.map(r => (r.id === rule.id ? next : r))) // Optimistic UI
    setSavingId(rule.id)
    const res = await fetch(`/api/pocket-money/rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowanceManagementType: next.allowanceManagementType,
        allowanceRequiresCollection: next.allowanceRequiresCollection,
      }),
    })
    setSavingId(null)
    if (!res.ok) {
      setRules(list => list && list.map(r => (r.id === rule.id ? rule : r)))
      setError((await res.json().catch(() => ({}))).error || '保存に失敗しました')
    } else {
      setError(null)
    }
  }

  const count = (type: string | null) => rules?.filter(r => r.allowanceManagementType === type).length ?? 0
  const collectionCount = rules?.filter(r => r.allowanceRequiresCollection).length ?? 0

  return (
    <section className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b-2 border-gray-100">
        <h2 className="font-bold text-gray-800">📋 事前のルール設定（管理区分・事後回収）</h2>
        <p className="text-xs text-gray-500 mt-0.5">利用者ごとに小遣いの管理区分と、お釣り・レシート等の事後回収が必要かを設定します。変更はすぐに保存されます。</p>
      </div>

      <div className="p-4 space-y-3">
        {error && <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

        {rules && (
          <div className="flex flex-wrap gap-2 text-xs">
            {ALLOWANCE_TYPES.map(t => (
              <span key={t.value} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-700">
                {t.label} <b>{count(t.value)}</b>名
              </span>
            ))}
            <span className={`rounded-full border px-2.5 py-1 ${count(null) > 0 ? 'border-orange-300 bg-orange-50 text-orange-800 font-bold' : 'border-gray-200 bg-white text-gray-700'}`}>
              未設定 <b>{count(null)}</b>名
            </span>
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-700">
              事後回収あり <b>{collectionCount}</b>名
            </span>
          </div>
        )}

        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer select-none">区分の説明</summary>
          <ul className="mt-1 ml-4 list-disc space-y-0.5">
            {ALLOWANCE_TYPES.map(t => <li key={t.value}><b>{t.label}</b>：{t.description}</li>)}
            <li>自己管理（法人準備なし）の方は事後回収の対象外です</li>
          </ul>
        </details>

        {!rules ? (
          !error && <div className="text-center py-6 text-gray-400 text-sm">読み込み中...</div>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {rules.map(rule => {
              const collectable = canRequireCollection(rule.allowanceManagementType)
              return (
                <li key={rule.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${savingId === rule.id ? 'bg-blue-50/50' : 'bg-white'}`}>
                  <div className="min-w-[8rem] flex-1">
                    <div className="font-semibold text-gray-800 text-sm">{rule.name}</div>
                    {rule.facility && <div className="text-[11px] text-gray-500">{rule.facility}</div>}
                  </div>
                  {/* 管理区分（3択）。選択中をもう一度押すと未設定に戻る */}
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden" role="radiogroup" aria-label={`${rule.name}の管理区分`}>
                    {ALLOWANCE_TYPES.map(t => {
                      const active = rule.allowanceManagementType === t.value
                      return (
                        <button
                          key={t.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          title={t.description}
                          onClick={() => save(rule, { allowanceManagementType: active ? null : t.value })}
                          className={`px-2.5 py-1.5 text-xs font-semibold border-r last:border-r-0 border-gray-300 transition-colors ${
                            active ? t.color : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {t.short}
                        </button>
                      )
                    })}
                  </div>
                  <label className={`flex items-center gap-1.5 text-xs select-none ${collectable ? 'cursor-pointer text-gray-700' : 'cursor-not-allowed text-gray-300'}`}>
                    <input
                      type="checkbox"
                      checked={rule.allowanceRequiresCollection}
                      disabled={!collectable}
                      onChange={e => save(rule, { allowanceRequiresCollection: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    事後回収あり
                  </label>
                </li>
              )
            })}
            {rules.length === 0 && <li className="px-3 py-4 text-sm text-gray-400">参加する利用者がいません</li>}
          </ul>
        )}
      </div>
    </section>
  )
}
