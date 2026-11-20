'use client'
// 汎用の送迎表（機能キー "transport"）
// 拠点（集合場所・時刻）ごとに、車・徒歩などの枠を並べ、参加者を枠へドラッグ＆ドロップで割り当てる
// editable のときは、拠点・枠の作成／編集／削除／並べ替え、割り当て、送迎メモの編集ができる

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import PersonCard from '@/components/PersonCard'
import {
  SLOT_COLORS,
  SLOT_KINDS,
  slotColorOf,
  slotKindOf,
  type TransportPerson,
  type TransportResponse,
  type TransportSection,
  type TransportSlot,
} from '@/lib/transport'

// 落とし先の判定: ポインターの下にあるものを優先し、枠の中の人（at-）があればそれを選ぶ（その位置に入る）
// ポインターの下に何もないとき（タッチの端など）は重なりの大きさで判定する
const collision: CollisionDetection = args => {
  const hits = pointerWithin(args)
  if (hits.length === 0) return rectIntersection(args)
  const onPerson = hits.find(h => String(h.id).startsWith('at-'))
  return onPerson ? [onPerson] : hits
}

const EMPTY: TransportResponse = { sections: [], assignments: [], persons: [] }

async function loadBoard(): Promise<TransportResponse> {
  const res = await fetch('/api/transport', { cache: 'no-store' })
  return res.ok ? res.json() : EMPTY
}

async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.ok) return null
  const data = await res.json().catch(() => ({}))
  return (data.error as string) || '保存に失敗しました'
}

// スタッフ → 利用者、それぞれ名前順（枠の中は保存した並び順のまま）
const sortForList = (list: TransportPerson[]) =>
  [...list].sort((a, b) => (a.role === 'STAFF' ? 0 : 1) - (b.role === 'STAFF' ? 0 : 1) || a.name.localeCompare(b.name, 'ja'))

type Editing =
  | { type: 'new-section' }
  | { type: 'section'; id: number }
  | { type: 'new-slot'; sectionId: number }
  | { type: 'slot'; id: number }
  | { type: 'memo'; personId: number }
  | null

export default function TransportBoard({ editable = false }: { editable?: boolean }) {
  const [board, setBoard] = useState<TransportResponse>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => setBoard(await loadBoard()), [])
  useEffect(() => {
    loadBoard()
      .then(setBoard)
      .finally(() => setLoading(false))
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const personById = new Map(board.persons.map(p => [p.id, p]))
  const slotIds = new Set(board.sections.flatMap(s => s.slots.map(x => x.id)))
  // 「参加」の人で、存在する枠に入っている人だけを割り当て済みとする
  const assignments = board.assignments.filter(a => personById.has(a.personId) && slotIds.has(a.slotId))
  const slotOf = new Map(assignments.map(a => [a.personId, a.slotId]))
  const membersOf = (slotId: number) =>
    assignments
      .filter(a => a.slotId === slotId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(a => personById.get(a.personId)!)
  const unassigned = sortForList(board.persons.filter(p => !slotOf.has(p.id)))
  const allSlots = board.sections.flatMap(s => s.slots)
  const overSlots = allSlots.filter(s => s.capacity !== null && membersOf(s.id).length > s.capacity)

  // 書き込み → エラー表示 → 読み込み直し
  const run = async (fn: () => Promise<string | null>) => {
    setSaving(true)
    const err = await fn()
    setError(err)
    await reload()
    setSaving(false)
    return err === null
  }

  const assign = async (personId: number, slotId: number | null, index?: number) => {
    // 画面を先に動かす（保存後に読み込み直して確定）
    setBoard(prev => {
      const rest = prev.assignments.filter(a => a.personId !== personId)
      if (slotId === null) return { ...prev, assignments: rest }
      const members = rest.filter(a => a.slotId === slotId).sort((a, b) => a.sortOrder - b.sortOrder)
      const at = index === undefined ? members.length : index
      members.splice(at, 0, { personId, slotId, sortOrder: at })
      const renumbered = members.map((a, i) => ({ ...a, sortOrder: i }))
      return { ...prev, assignments: [...rest.filter(a => a.slotId !== slotId), ...renumbered] }
    })
    await run(() => request('/api/transport/assign', 'PUT', { personId, slotId, index }))
  }

  const onDragStart = (event: DragStartEvent) => setActiveId(Number(String(event.active.id).replace('person-', '')))

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const personId = Number(String(active.id).replace('person-', ''))
    const overId = String(over.id)
    if (overId === 'unassigned') {
      if (slotOf.has(personId)) assign(personId, null)
    } else if (overId.startsWith('slot-')) {
      const slotId = Number(overId.slice(5))
      if (slotOf.get(personId) !== slotId) assign(personId, slotId)
    } else if (overId.startsWith('at-')) {
      // 枠の中の人の上に落とした → その人の位置に入る（同じ枠なら並べ替え）
      const targetId = Number(overId.slice(3))
      const slotId = slotOf.get(targetId)
      if (slotId === undefined || targetId === personId) return
      const others = membersOf(slotId).filter(p => p.id !== personId)
      assign(personId, slotId, others.findIndex(p => p.id === targetId))
    }
  }

  const move = async <T extends { id: number }>(list: T[], index: number, delta: number, body: (ids: number[]) => object) => {
    const to = index + delta
    if (to < 0 || to >= list.length) return
    const ids = list.map(x => x.id)
    ;[ids[index], ids[to]] = [ids[to], ids[index]]
    await run(() => request('/api/transport/reorder', 'PUT', body(ids)))
  }

  const activePerson = activeId !== null ? personById.get(activeId) : undefined

  if (loading) return <div className="text-center py-10 text-gray-400">読み込み中...</div>

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-5">
        {/* 集計と警告 */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
            参加 <b>{board.persons.length}</b>名 ／ 割り当て済み <b>{board.persons.length - unassigned.length}</b>名 ／ 未割り当て{' '}
            <b className={unassigned.length ? 'text-amber-700' : ''}>{unassigned.length}</b>名
          </span>
          {overSlots.length > 0 && (
            <span className="rounded-xl border-2 border-red-400 bg-red-50 px-3 py-1.5 font-bold text-red-700">
              ⚠️ 定員オーバーの枠があります：{overSlots.map(s => s.name).join('、')}
            </span>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

        <div className="flex flex-col 2xl:flex-row gap-5 items-start">
          {(editable || unassigned.length > 0) && (
            <UnassignedPanel persons={unassigned} editable={editable} onMemo={id => setEditing({ type: 'memo', personId: id })} />
          )}

          <div className="flex-1 w-full space-y-5">
            {board.sections.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                {editable ? 'まだ拠点がありません。下の「＋ 拠点を追加」から、集合場所と時刻を作ってください。' : '送迎表はまだ作られていません。'}
              </div>
            )}

            {board.sections.map((section, si) => {
              const total = section.slots.reduce((n, s) => n + membersOf(s.id).length, 0)
              return (
                <section key={section.id} className="break-inside-avoid rounded-2xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
                  {editing?.type === 'section' && editing.id === section.id ? (
                    <div className="p-4 bg-slate-50">
                      <SectionForm
                        initial={section}
                        saving={saving}
                        onCancel={() => setEditing(null)}
                        onSave={async body => (await run(() => request(`/api/transport/sections/${section.id}`, 'PUT', body))) && setEditing(null)}
                      />
                    </div>
                  ) : (
                    <div className="px-4 py-3 bg-slate-700 text-white flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="font-bold">📍 {section.name}</h2>
                      {section.time && <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">🕗 {section.time}</span>}
                      {section.memo && <span className="text-xs text-slate-200">{section.memo}</span>}
                      <span className="ml-auto text-sm text-slate-200">{total}名</span>
                      {editable && (
                        <div className="flex gap-1 print:hidden">
                          <IconButton label="上へ" onClick={() => move(board.sections, si, -1, ids => ({ type: 'sections', ids }))} disabled={saving || si === 0}>↑</IconButton>
                          <IconButton label="下へ" onClick={() => move(board.sections, si, 1, ids => ({ type: 'sections', ids }))} disabled={saving || si === board.sections.length - 1}>↓</IconButton>
                          <IconButton label="拠点を編集" onClick={() => setEditing({ type: 'section', id: section.id })} disabled={saving}>✏️</IconButton>
                          <IconButton
                            label="拠点を削除"
                            disabled={saving}
                            onClick={() =>
                              confirm(`拠点「${section.name}」と、その中の枠 ${section.slots.length}個を削除します。乗っていた ${total}名は未割り当てに戻ります。よろしいですか？`) &&
                              run(() => request(`/api/transport/sections/${section.id}`, 'DELETE'))
                            }
                          >
                            🗑
                          </IconButton>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {section.slots.map((slot, i) =>
                      editing?.type === 'slot' && editing.id === slot.id ? (
                        <SlotForm
                          key={slot.id}
                          initial={slot}
                          sections={board.sections}
                          saving={saving}
                          onCancel={() => setEditing(null)}
                          onSave={async body => (await run(() => request(`/api/transport/slots/${slot.id}`, 'PUT', body))) && setEditing(null)}
                        />
                      ) : (
                        <SlotBox
                          key={slot.id}
                          slot={slot}
                          members={membersOf(slot.id)}
                          editable={editable}
                          saving={saving}
                          first={i === 0}
                          last={i === section.slots.length - 1}
                          onMove={delta => move(section.slots, i, delta, ids => ({ type: 'slots', sectionId: section.id, ids }))}
                          onEdit={() => setEditing({ type: 'slot', id: slot.id })}
                          onDelete={() =>
                            confirm(`枠「${slot.name}」を削除します。乗っていた ${membersOf(slot.id).length}名は未割り当てに戻ります。よろしいですか？`) &&
                            run(() => request(`/api/transport/slots/${slot.id}`, 'DELETE'))
                          }
                          onMemo={id => setEditing({ type: 'memo', personId: id })}
                        />
                      )
                    )}
                    {editable &&
                      (editing?.type === 'new-slot' && editing.sectionId === section.id ? (
                        <SlotForm
                          initial={{ sectionId: section.id }}
                          sections={board.sections}
                          saving={saving}
                          onCancel={() => setEditing(null)}
                          onSave={async body => (await run(() => request('/api/transport/slots', 'POST', { ...body, sectionId: section.id }))) && setEditing(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setEditing({ type: 'new-slot', sectionId: section.id })}
                          disabled={saving}
                          className="print:hidden min-h-[120px] rounded-2xl border-2 border-dashed border-blue-300 text-blue-600 font-semibold text-sm bg-white hover:bg-blue-50"
                        >
                          ＋ 枠を追加（車・徒歩など）
                        </button>
                      ))}
                  </div>
                </section>
              )
            })}

            {editable &&
              (editing?.type === 'new-section' ? (
                <div className="rounded-2xl border-2 border-blue-400 bg-white p-4 shadow-md">
                  <SectionForm
                    saving={saving}
                    onCancel={() => setEditing(null)}
                    onSave={async body => (await run(() => request('/api/transport/sections', 'POST', body))) && setEditing(null)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setEditing({ type: 'new-section' })}
                  disabled={saving}
                  className="print:hidden w-full py-3 rounded-2xl border-2 border-dashed border-slate-400 text-slate-700 font-semibold text-sm bg-white hover:bg-slate-50"
                >
                  ＋ 拠点を追加（集合場所・時刻）
                </button>
              ))}
          </div>
        </div>
      </div>

      {editing?.type === 'memo' && personById.get(editing.personId) && (
        <MemoDialog
          person={personById.get(editing.personId)!}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={async memo =>
            (await run(() => request(`/api/transport/memo/${editing.personId}`, 'PUT', { pickupMemo: memo }))) && setEditing(null)
          }
        />
      )}

      <DragOverlay>
        {activePerson ? <PersonCard person={activePerson} memo={activePerson.pickupMemo} draggable isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-white/15 px-2 py-0.5 text-xs hover:bg-white/30 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function SlotBox({ slot, members, editable, saving, first, last, onMove, onEdit, onDelete, onMemo }: {
  slot: TransportSlot
  members: TransportPerson[]
  editable: boolean
  saving: boolean
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  onEdit: () => void
  onDelete: () => void
  onMemo: (personId: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot.id}`, disabled: !editable })
  const kind = slotKindOf(slot.kind)
  const over = slot.capacity !== null && members.length > slot.capacity
  const full = slot.capacity !== null && members.length === slot.capacity
  const wheelchairCount = members.filter(p => p.isWheelchair).length
  const color = over ? 'bg-red-50 border-red-500' : slotColorOf(slot.color, slot.kind).box

  return (
    <div
      ref={setNodeRef}
      className={`print-avoid-break rounded-2xl border-4 overflow-hidden transition-colors ${color} ${isOver ? 'ring-4 ring-indigo-300 shadow-md' : 'shadow-sm'}`}
    >
      <div className="px-4 py-2 bg-white/60 border-b-2 border-black/10">
        <div className="font-bold text-base text-gray-800 flex justify-between items-center gap-2">
          <span className={`min-w-0 break-words ${over ? 'text-red-700' : ''}`}>
            {kind.icon} {slot.name}
            {slot.capacity !== null && <span className="text-sm font-medium">（定員：{slot.capacity}名）</span>}
          </span>
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            {wheelchairCount > 0 && <span className="bg-pink-200 text-pink-800 px-1.5 py-0.5 rounded-full text-xs">♿️ {wheelchairCount}</span>}
            <span className={over ? 'text-red-700 font-bold' : full ? 'text-amber-700 font-bold' : ''}>
              {members.length}
              {slot.capacity !== null && `/${slot.capacity}`}名
            </span>
          </div>
        </div>
        {over && <p className="text-xs font-bold text-red-700 mt-0.5">⚠️ 定員オーバー（+{members.length - slot.capacity!}名）</p>}
        {slot.memo && <p className="text-xs text-gray-600 mt-0.5 break-words">📝 {slot.memo}</p>}
        {editable && (
          <div className="mt-1 flex gap-1 print:hidden">
            <SmallButton onClick={() => onMove(-1)} disabled={saving || first} label="前へ">←</SmallButton>
            <SmallButton onClick={() => onMove(1)} disabled={saving || last} label="後ろへ">→</SmallButton>
            <SmallButton onClick={onEdit} disabled={saving} label="枠を編集">✏️ 編集</SmallButton>
            <SmallButton onClick={onDelete} disabled={saving} label="枠を削除">🗑 削除</SmallButton>
          </div>
        )}
      </div>
      <div className="min-h-[100px] p-3 flex flex-col gap-2">
        {members.map(p => (
          <DraggablePerson key={p.id} person={p} editable={editable} dropTarget onMemo={onMemo} />
        ))}
        {members.length === 0 && editable && <p className="text-xs text-gray-400 print:hidden">ここへドラッグして割り当て</p>}
      </div>
    </div>
  )
}

function SmallButton({ onClick, disabled, label, children }: { onClick: () => void; disabled?: boolean; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-black/10 bg-white px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function UnassignedPanel({ persons, editable, onMemo }: { persons: TransportPerson[]; editable: boolean; onMemo: (id: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned', disabled: !editable })
  const groups = [
    { title: 'スタッフ', list: persons.filter(p => p.role === 'STAFF') },
    { title: '利用者', list: persons.filter(p => p.role !== 'STAFF') },
  ]
  return (
    <div
      ref={setNodeRef}
      className={`print:hidden w-full 2xl:w-64 2xl:shrink-0 2xl:sticky 2xl:top-4 bg-white rounded-2xl border-2 p-4 transition-colors ${
        isOver ? 'border-red-400 bg-red-50 shadow-md' : 'border-gray-200 shadow-sm'
      }`}
    >
      <h3 className="font-bold text-gray-800">未割り当て - {persons.length}名</h3>
      {editable && <p className="text-xs text-gray-500 mb-2">長押しで枠へドラッグ。ここへ戻すと割り当てを解除します。📝 で送迎メモを編集</p>}
      <div className="max-h-[320px] 2xl:max-h-[calc(100vh-220px)] overflow-y-auto pr-1 space-y-3 mt-2">
        {groups.map(
          g =>
            g.list.length > 0 && (
              <div key={g.title}>
                <div className="text-xs font-semibold text-gray-500 mb-1.5">{g.title}（{g.list.length}名）</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-1 gap-2">
                  {g.list.map(p => (
                    <DraggablePerson key={p.id} person={p} editable={editable} onMemo={onMemo} />
                  ))}
                </div>
              </div>
            )
        )}
        {persons.length === 0 && (
          <p className="text-sm text-gray-400">
            全員の送迎が決まっています（参加者がいないときは「参加者の登録」で参加にしてください）
          </p>
        )}
      </div>
    </div>
  )
}

function DraggablePerson({ person, editable, dropTarget = false, onMemo }: {
  person: TransportPerson
  editable: boolean
  dropTarget?: boolean // 枠の中の人: この人の上に落とすと、その位置に入る
  onMemo: (personId: number) => void
}) {
  const drag = useDraggable({ id: `person-${person.id}`, disabled: !editable })
  const drop = useDroppable({ id: `at-${person.id}`, disabled: !editable || !dropTarget })
  const style = drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` } : undefined
  return (
    <div
      ref={node => {
        drag.setNodeRef(node)
        drop.setNodeRef(node)
      }}
      style={style}
      className={`relative ${drop.isOver && !drag.isDragging ? 'before:absolute before:-top-1.5 before:left-0 before:right-0 before:h-1 before:rounded before:bg-indigo-500' : ''}`}
    >
      <PersonCard
        person={person}
        memo={person.pickupMemo}
        draggable={editable}
        isDragging={drag.isDragging}
        {...drag.listeners}
        {...drag.attributes}
        className={editable ? 'pr-8' : ''}
      />
      {editable && (
        <button
          type="button"
          title="送迎メモを編集"
          aria-label={`${person.name}さんの送迎メモを編集`}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onMemo(person.id)}
          className="print:hidden absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 text-sm opacity-60 hover:opacity-100 hover:bg-black/5"
        >
          📝
        </button>
      )}
    </div>
  )
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

function SectionForm({ initial, saving, onSave, onCancel }: {
  initial?: Partial<TransportSection>
  saving: boolean
  onSave: (body: { name: string; time: string; memo: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [time, setTime] = useState(initial?.time ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSave({ name, time, memo })
      }}
      className="grid gap-2 md:grid-cols-[2fr_1fr_3fr_auto] items-end"
    >
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">拠点の名前 *</span>
        <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="例: グレイス前" required autoFocus />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">時刻</span>
        <input className={inputClass} value={time} onChange={e => setTime(e.target.value)} placeholder="例: 16:30" />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">メモ</span>
        <input className={inputClass} value={memo} onChange={e => setMemo(e.target.value)} placeholder="例: 正面玄関に集合" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          保存
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
          取消
        </button>
      </div>
    </form>
  )
}

function SlotForm({ initial, sections, saving, onSave, onCancel }: {
  initial: Partial<TransportSlot>
  sections: TransportSection[]
  saving: boolean
  onSave: (body: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: initial.name ?? '',
    kind: initial.kind ?? 'car',
    capacity: initial.capacity == null ? '' : String(initial.capacity),
    color: initial.color ?? '',
    memo: initial.memo ?? '',
    sectionId: initial.sectionId ?? sections[0]?.id,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))
  const isNew = initial.id === undefined
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSave({ ...form, capacity: form.capacity === '' ? null : Number(form.capacity), color: form.color || null })
      }}
      className="rounded-2xl border-2 border-blue-400 bg-white p-3 shadow-md space-y-2"
    >
      <div className="text-sm font-bold text-blue-700">{isNew ? '＋ 枠を追加' : '✏️ 枠を編集'}</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block col-span-2">
          <span className="text-xs font-semibold text-gray-600">名前 *</span>
          <input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} placeholder="例: 1号車（ハイエース）" required autoFocus />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">種類</span>
          <select className={inputClass} value={form.kind} onChange={e => set('kind', e.target.value)}>
            {SLOT_KINDS.map(k => (
              <option key={k.key} value={k.key}>
                {k.icon} {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">定員（なしは空欄）</span>
          <input type="number" min={1} max={99} className={inputClass} value={form.capacity} onChange={e => set('capacity', e.target.value)} />
        </label>
      </div>
      <div>
        <span className="text-xs font-semibold text-gray-600">色</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <ColorChip active={form.color === ''} onClick={() => set('color', '')} label="自動" dot="bg-white border border-gray-300" />
          {SLOT_COLORS.map(c => (
            <ColorChip key={c.key} active={form.color === c.key} onClick={() => set('color', c.key)} label={c.label} dot={c.dot} />
          ))}
        </div>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">メモ</span>
        <input className={inputClass} value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="例: 運転 ○○さん・リフト付き" />
      </label>
      {!isNew && sections.length > 1 && (
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">拠点</span>
          <select className={inputClass} value={form.sectionId} onChange={e => set('sectionId', Number(e.target.value))}>
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !form.name.trim()} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50">
          保存
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
          取消
        </button>
      </div>
    </form>
  )
}

function ColorChip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
    >
      <span className={`inline-block h-3 w-3 rounded-full ${dot}`} />
      {label}
    </button>
  )
}

function MemoDialog({ person, saving, onSave, onCancel }: {
  person: TransportPerson
  saving: boolean
  onSave: (memo: string) => void
  onCancel: () => void
}) {
  const [memo, setMemo] = useState(person.pickupMemo ?? '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden" onClick={onCancel}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={e => {
          e.preventDefault()
          onSave(memo)
        }}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3"
      >
        <h3 className="font-bold text-gray-800">📝 {person.name}さんの送迎メモ</h3>
        <p className="text-xs text-gray-500">このイベントだけのメモです（空欄で保存すると削除）。</p>
        <textarea className={inputClass} rows={3} maxLength={200} value={memo} onChange={e => setMemo(e.target.value)} placeholder="例: 母が店まで送迎" autoFocus />
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50">
            保存
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600">
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
