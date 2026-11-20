'use client'
// 汎用の席レイアウト（機能キー "seating"）
// - 配置図ごとに、テーブル（席数・車椅子枠・形）と目印（入口・レジなど）を自由に置く
// - 配置モード: テーブル・目印の追加／ドラッグで移動／編集／削除（editable のときだけ）
// - 割り当てモード: 参加者を席へドラッグ。座っている人の席に落とすと入れ替え（未配置の人なら相手は未配置へ）
// 1つの席に1人・1つの配置図で1人1席。車椅子の配慮は警告で知らせる（割り当て自体は止めない）

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
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
  GRID,
  LANDMARK_KINDS,
  MAX_SEATS,
  TABLE_SHAPES,
  isWheelchairSeat,
  landmarkKindOf,
  tableGeometry,
  type SeatAssignmentData,
  type SeatLandmarkData,
  type SeatLayoutData,
  type SeatPerson,
  type SeatTableData,
  type SeatingResponse,
} from '@/lib/seating'

const EMPTY: SeatingResponse = { layouts: [], assignments: [], persons: [] }
type Mode = 'assign' | 'place'
type Selected = { type: 'table' | 'landmark'; id: number } | null

async function loadBoard(): Promise<SeatingResponse> {
  const res = await fetch('/api/seating', { cache: 'no-store' })
  return res.ok ? res.json() : EMPTY
}

async function request(url: string, method: string, body?: unknown): Promise<{ error: string | null; json: Record<string, unknown> | null }> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  return { error: res.ok ? null : (json?.error as string) || '保存に失敗しました', json }
}

const collision: CollisionDetection = args => {
  const hits = pointerWithin(args)
  return hits.length ? hits : rectIntersection(args)
}

const sortForList = (list: SeatPerson[]) =>
  [...list].sort((a, b) => (a.role === 'STAFF' ? 0 : 1) - (b.role === 'STAFF' ? 0 : 1) || a.name.localeCompare(b.name, 'ja'))

export default function SeatingBoard({ editable = false }: { editable?: boolean }) {
  const [board, setBoard] = useState<SeatingResponse>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [layoutId, setLayoutId] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('assign')
  const [selected, setSelected] = useState<Selected>(null)
  const [layoutForm, setLayoutForm] = useState<'new' | 'edit' | null>(null)
  const [dragPersonId, setDragPersonId] = useState<number | null>(null)
  const [scale, setScale] = useState(1)

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

  const layout = board.layouts.find(l => l.id === layoutId) ?? board.layouts[0] ?? null
  const personById = new Map(board.persons.map(p => [p.id, p]))
  const tableById = new Map((layout?.tables ?? []).map(t => [t.id, t]))
  // この配置図の割り当て（参加の人・存在する席だけ）
  const seated = board.assignments.filter(
    a => layout && a.layoutId === layout.id && personById.has(a.personId) && tableById.has(a.tableId) && a.seatIndex < tableById.get(a.tableId)!.seats
  )
  const seatOf = new Map(seated.map(a => [a.personId, a]))
  const occupantOf = (tableId: number, seatIndex: number) => seated.find(a => a.tableId === tableId && a.seatIndex === seatIndex)
  const unassigned = sortForList(board.persons.filter(p => !seatOf.has(p.id)))

  // 車椅子の配慮（警告）
  const wcSeatCount = (layout?.tables ?? []).reduce((n, t) => n + t.wheelchairSlots, 0)
  const wcUsers = board.persons.filter(p => p.isWheelchair)
  const wcOnNormal = seated.filter(a => personById.get(a.personId)!.isWheelchair && !isWheelchairSeat(tableById.get(a.tableId)!, a.seatIndex))
  const normalOnWc = seated.filter(a => !personById.get(a.personId)!.isWheelchair && isWheelchairSeat(tableById.get(a.tableId)!, a.seatIndex))
  const warnSeat = (a: SeatAssignmentData | undefined) => !!a && (wcOnNormal.includes(a) || normalOnWc.includes(a))
  // 配置の重なり（テーブルどうし・テーブルと目印）。席に座れなくなるので配置モードで警告する
  const boxes = [
    ...(layout?.tables ?? []).map(t => ({ name: t.name, table: true, x: t.x, y: t.y, w: tableGeometry(t).w, h: tableGeometry(t).h })),
    ...(layout?.landmarks ?? []).map(l => ({ name: l.label, table: false, x: l.x, y: l.y, w: l.w, h: l.h })),
  ]
  const overlaps = boxes.flatMap((a, i) =>
    boxes
      .slice(i + 1)
      .filter(b => (a.table || b.table) && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
      .map(b => `${a.name} と ${b.name}`)
  )
  const nameOf = (a: SeatAssignmentData) => `${personById.get(a.personId)!.name}（${tableById.get(a.tableId)!.name}）`

  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setSaving(true)
    const { error: err } = await fn()
    setError(err)
    await reload()
    setSaving(false)
    return err === null
  }

  // ===== 割り当て =====
  const assign = async (personId: number, tableId: number | null, seatIndex?: number) => {
    if (!layout) return
    const mine = seatOf.get(personId)
    if (tableId === null && !mine) return
    if (mine && tableId === mine.tableId && seatIndex === mine.seatIndex) return
    // 画面を先に動かす（入れ替え・押し出しもサーバーと同じ考え方）
    setBoard(prev => {
      let list = prev.assignments.filter(a => !(a.layoutId === layout.id && a.personId === personId))
      if (tableId !== null && seatIndex !== undefined) {
        const occ = list.find(a => a.layoutId === layout.id && a.tableId === tableId && a.seatIndex === seatIndex)
        list = list.filter(a => a !== occ)
        if (occ && mine) list.push({ ...occ, tableId: mine.tableId, seatIndex: mine.seatIndex })
        list.push({ layoutId: layout.id, tableId, seatIndex, personId })
      }
      return { ...prev, assignments: list }
    })
    await run(() => request('/api/seating/assign', 'PUT', { layoutId: layout.id, personId, tableId, seatIndex }))
  }

  // ===== 配置 =====
  const moveItem = async (type: 'table' | 'landmark', id: number, dx: number, dy: number) => {
    if (!layout) return
    const item = type === 'table' ? layout.tables.find(t => t.id === id) : layout.landmarks.find(l => l.id === id)
    if (!item) return
    const x = Math.round((item.x + dx / scale) / GRID) * GRID
    const y = Math.round((item.y + dy / scale) / GRID) * GRID
    setBoard(prev => ({
      ...prev,
      layouts: prev.layouts.map(l =>
        l.id !== layout.id
          ? l
          : type === 'table'
            ? { ...l, tables: l.tables.map(t => (t.id === id ? { ...t, x, y } : t)) }
            : { ...l, landmarks: l.landmarks.map(m => (m.id === id ? { ...m, x, y } : m)) }
      ),
    }))
    await run(() => request(`/api/seating/${type === 'table' ? 'tables' : 'landmarks'}/${id}`, 'PUT', { x, y }))
  }

  // 新しいテーブル・目印を置く場所（左上から少しずつずらす）
  const nextSpot = () => {
    const n = (layout?.tables.length ?? 0) + (layout?.landmarks.length ?? 0)
    return { x: 20 + (n % 6) * 40, y: 20 + (n % 6) * 30 }
  }

  const addTable = async () => {
    if (!layout) return
    const { error: err, json } = await request('/api/seating/tables', 'POST', {
      layoutId: layout.id,
      name: `テーブル${layout.tables.length + 1}`,
      shape: 'rect',
      seats: 4,
      wheelchairSlots: 0,
      ...nextSpot(),
    })
    setError(err)
    await reload()
    if (json?.id) setSelected({ type: 'table', id: Number(json.id) })
  }

  const addLandmark = async (kind: string) => {
    if (!layout) return
    const { error: err, json } = await request('/api/seating/landmarks', 'POST', { layoutId: layout.id, kind, ...nextSpot() })
    setError(err)
    await reload()
    if (json?.id) setSelected({ type: 'landmark', id: Number(json.id) })
  }

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    if (id.startsWith('person-')) setDragPersonId(Number(id.slice(7)))
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragPersonId(null)
    const id = String(e.active.id)
    if (id.startsWith('table-') || id.startsWith('landmark-')) {
      const [type, num] = id.split('-')
      if (e.delta.x !== 0 || e.delta.y !== 0) moveItem(type as 'table' | 'landmark', Number(num), e.delta.x, e.delta.y)
      return
    }
    if (!id.startsWith('person-') || !e.over) return
    const personId = Number(id.slice(7))
    const over = String(e.over.id)
    if (over === 'unassigned') assign(personId, null)
    else if (over.startsWith('seat-')) {
      const [, t, i] = over.split('-')
      assign(personId, Number(t), Number(i))
    }
  }

  if (loading) return <div className="text-center py-10 text-gray-400">読み込み中...</div>

  const dragPerson = dragPersonId !== null ? personById.get(dragPersonId) : undefined
  const selectedTable = selected?.type === 'table' ? layout?.tables.find(t => t.id === selected.id) : undefined
  const selectedLandmark = selected?.type === 'landmark' ? layout?.landmarks.find(l => l.id === selected.id) : undefined
  const placing = editable && mode === 'place'

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        {/* 配置図の切り替え */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {board.layouts.map(l => (
            <button
              key={l.id}
              onClick={() => {
                setLayoutId(l.id)
                setSelected(null)
                setLayoutForm(null)
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${layout?.id === l.id ? 'bg-rose-600 text-white shadow' : 'bg-white border-2 border-gray-200 text-gray-600'}`}
            >
              🪑 {l.name}
            </button>
          ))}
          {editable && (
            <>
              <button onClick={() => setLayoutForm('new')} disabled={saving} className="rounded-xl border-2 border-dashed border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 bg-white hover:bg-rose-50">
                ＋ 配置図を追加
              </button>
              {layout && (
                <button onClick={() => setLayoutForm('edit')} disabled={saving} className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">
                  ⚙️ この配置図の設定
                </button>
              )}
            </>
          )}
        </div>
        {layout && <h2 className="hidden print:block text-lg font-bold">🪑 {layout.name}</h2>}

        {editable && layoutForm && (
          <LayoutForm
            initial={layoutForm === 'edit' ? layout : null}
            saving={saving}
            onCancel={() => setLayoutForm(null)}
            onDelete={
              layoutForm === 'edit' && layout
                ? async () => {
                    const n = seated.length
                    if (!confirm(`配置図「${layout.name}」を削除します。テーブル ${layout.tables.length}台・目印 ${layout.landmarks.length}個と、${n}名の席の割り当ても消えます。よろしいですか？`)) return
                    if (await run(() => request(`/api/seating/layouts/${layout.id}`, 'DELETE'))) {
                      setLayoutForm(null)
                      setLayoutId(null)
                    }
                  }
                : undefined
            }
            onSave={async body => {
              if (layoutForm === 'new') {
                const res = await request('/api/seating/layouts', 'POST', body)
                setError(res.error)
                await reload()
                if (!res.error) {
                  setLayoutForm(null)
                  setLayoutId(Number(res.json?.id))
                  setMode('place')
                }
              } else if (layout && (await run(() => request(`/api/seating/layouts/${layout.id}`, 'PUT', body)))) {
                setLayoutForm(null)
              }
            }}
          />
        )}

        {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

        {!layout ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            {editable ? '配置図がまだありません。「＋ 配置図を追加」から、お店や会場の配置図を作ってください。' : '席レイアウトはまだ作られていません。'}
          </div>
        ) : (
          <>
            {/* モード切り替え・集計・警告 */}
            <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
              {editable && (
                <div className="flex overflow-hidden rounded-xl border-2 border-rose-300">
                  {(
                    [
                      ['assign', '👥 割り当てモード'],
                      ['place', '🧩 配置モード'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setMode(key)
                        setSelected(null)
                      }}
                      className={`px-3 py-1.5 font-semibold ${mode === key ? 'bg-rose-600 text-white' : 'bg-white text-rose-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <span className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
                参加 <b>{board.persons.length}</b>名 ／ 着席 <b>{seated.length}</b>名 ／ 未配置{' '}
                <b className={unassigned.length ? 'text-amber-700' : ''}>{unassigned.length}</b>名 ／ 席 {layout.tables.reduce((n, t) => n + t.seats, 0)}
              </span>
              <span className={`rounded-xl border px-3 py-1.5 ${wcUsers.length > wcSeatCount ? 'border-red-400 bg-red-50 text-red-700 font-bold' : 'border-pink-200 bg-pink-50 text-pink-800'}`}>
                ♿ 車椅子利用 {wcUsers.length}名 ／ 車椅子枠 {wcSeatCount}
                {wcUsers.length > wcSeatCount && '（枠が足りません）'}
              </span>
            </div>
            {placing && overlaps.length > 0 && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 print:hidden">
                ⚠️ 重なっているものがあります（席に座れない・見えない場合があります）：{overlaps.join('、')}
              </div>
            )}
            {(wcOnNormal.length > 0 || normalOnWc.length > 0) && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 space-y-0.5">
                {wcOnNormal.length > 0 && <p>⚠️ 車椅子の方が車椅子枠ではない席に座っています：{wcOnNormal.map(nameOf).join('、')}</p>}
                {normalOnWc.length > 0 && <p>ℹ️ 車椅子枠に車椅子以外の方が座っています：{normalOnWc.map(nameOf).join('、')}</p>}
              </div>
            )}

            <div className="flex flex-col xl:flex-row gap-4 items-start">
              {/* 左: 割り当てモードは未配置の人、配置モードは道具と編集 */}
              {placing ? (
                <div className="w-full xl:w-72 xl:shrink-0 xl:sticky xl:top-4 space-y-3 print:hidden">
                  <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-sm space-y-2">
                    <div className="text-sm font-bold text-gray-700">追加する</div>
                    <button onClick={addTable} disabled={saving} className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      ＋ テーブル
                    </button>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LANDMARK_KINDS.map(k => (
                        <button key={k.key} onClick={() => addLandmark(k.key)} disabled={saving} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${k.className} disabled:opacity-50`}>
                          ＋ {k.icon} {k.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">配置図の上のテーブル・目印はドラッグで動かせます。クリックすると下で編集できます。</p>
                  </div>
                  {selectedTable && (
                    <TableForm
                      key={selectedTable.id}
                      table={selectedTable}
                      seatedCount={(n: number) => seated.filter(a => a.tableId === selectedTable.id && a.seatIndex >= n).length}
                      saving={saving}
                      onClose={() => setSelected(null)}
                      onSave={body => run(() => request(`/api/seating/tables/${selectedTable.id}`, 'PUT', body))}
                      onDelete={async () => {
                        const n = seated.filter(a => a.tableId === selectedTable.id).length
                        if (!confirm(`「${selectedTable.name}」を削除します。${n ? `座っている ${n}名は未配置に戻ります。` : ''}よろしいですか？`)) return
                        if (await run(() => request(`/api/seating/tables/${selectedTable.id}`, 'DELETE'))) setSelected(null)
                      }}
                    />
                  )}
                  {selectedLandmark && (
                    <LandmarkForm
                      key={selectedLandmark.id}
                      landmark={selectedLandmark}
                      saving={saving}
                      onClose={() => setSelected(null)}
                      onSave={body => run(() => request(`/api/seating/landmarks/${selectedLandmark.id}`, 'PUT', body))}
                      onDelete={async () => {
                        if (!confirm(`目印「${selectedLandmark.label}」を削除します。よろしいですか？`)) return
                        if (await run(() => request(`/api/seating/landmarks/${selectedLandmark.id}`, 'DELETE'))) setSelected(null)
                      }}
                    />
                  )}
                </div>
              ) : (
                (editable || unassigned.length > 0) && <UnassignedPanel persons={unassigned} editable={editable} />
              )}

              <Canvas layout={layout} onScale={setScale}>
                {layout.landmarks.map(l => (
                  <LandmarkBox key={l.id} landmark={l} scale={scale} placing={placing} selected={selected?.type === 'landmark' && selected.id === l.id} onSelect={() => setSelected({ type: 'landmark', id: l.id })} />
                ))}
                {layout.tables.map(t => (
                  <TableBox
                    key={t.id}
                    table={t}
                    scale={scale}
                    placing={placing}
                    assigning={editable && mode === 'assign'}
                    selected={selected?.type === 'table' && selected.id === t.id}
                    onSelect={() => setSelected({ type: 'table', id: t.id })}
                    occupantOf={i => {
                      const a = occupantOf(t.id, i)
                      return a ? { person: personById.get(a.personId)!, warn: warnSeat(a) } : null
                    }}
                    count={seated.filter(a => a.tableId === t.id).length}
                  />
                ))}
              </Canvas>
            </div>
          </>
        )}
      </div>

      <DragOverlay>{dragPerson ? <PersonCard person={dragPerson} draggable isOverlay className="w-40" /> : null}</DragOverlay>
    </DndContext>
  )
}

// ===== 配置図（論理ピクセルの面を、画面の幅に合わせて縮小して表示） =====
function Canvas({ layout, onScale, children }: { layout: SeatLayoutData; onScale: (s: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      // 小さすぎると読めないので 0.5 倍までにし、それ以上は横スクロールにする
      const s = Math.max(0.5, Math.min(1, el.clientWidth / layout.width))
      setScale(s)
      onScale(s)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layout.width, onScale])

  return (
    <div ref={ref} className="flex-1 w-full min-w-0 overflow-x-auto rounded-2xl border-2 border-gray-200 bg-white shadow-sm print:overflow-visible print:border-0 print:shadow-none">
      {scale > 0 && (
        <div style={{ width: layout.width * scale, height: layout.height * scale }} className="relative">
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${scale})`,
              backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

// 配置図は縮小表示しているので、画面上の移動量を論理ピクセルに直して動かす
function dragStyle(transform: { x: number; y: number } | null, scale: number): CSSProperties {
  return transform ? { transform: `translate(${transform.x / scale}px, ${transform.y / scale}px)`, zIndex: 30 } : {}
}

function LandmarkBox({ landmark: l, scale, placing, selected, onSelect }: {
  landmark: SeatLandmarkData
  scale: number
  placing: boolean
  selected: boolean
  onSelect: () => void
}) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id: `landmark-${l.id}`, disabled: !placing })
  const kind = landmarkKindOf(l.kind)
  return (
    <div
      ref={setNodeRef}
      {...(placing ? { ...listeners, ...attributes } : {})}
      onClick={placing ? onSelect : undefined}
      className={`absolute flex items-center justify-center rounded-lg border-2 text-center text-sm font-bold ${kind.className} ${placing ? 'cursor-move' : ''} ${selected ? 'ring-4 ring-rose-400' : ''}`}
      style={{ left: l.x, top: l.y, width: l.w, height: l.h, ...dragStyle(transform, scale) }}
    >
      <span className="px-1 leading-tight">
        {kind.icon} {l.label}
      </span>
    </div>
  )
}

function TableBox({ table, scale, placing, assigning, selected, onSelect, occupantOf, count }: {
  table: SeatTableData
  scale: number
  placing: boolean
  assigning: boolean
  selected: boolean
  onSelect: () => void
  occupantOf: (seatIndex: number) => { person: SeatPerson; warn: boolean } | null
  count: number
}) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id: `table-${table.id}`, disabled: !placing })
  const g = tableGeometry(table)
  return (
    <div
      ref={setNodeRef}
      {...(placing ? { ...listeners, ...attributes } : {})}
      onClick={placing ? onSelect : undefined}
      className={`absolute ${placing ? 'cursor-move' : ''} ${selected ? 'ring-4 ring-rose-400 rounded-xl' : ''}`}
      style={{ left: table.x, top: table.y, width: g.w, height: g.h, ...dragStyle(transform, scale) }}
    >
      <div
        className={`absolute flex flex-col items-center justify-center border-2 border-amber-700/60 bg-amber-100 text-center leading-tight ${g.body.round ? 'rounded-full' : 'rounded-md'}`}
        style={{ left: g.body.x, top: g.body.y, width: g.body.w, height: g.body.h }}
      >
        <span className="text-xs font-bold text-amber-950 px-1 truncate max-w-full">{table.name}</span>
        <span className="text-[10px] text-amber-900">
          {count}/{table.seats}
          {table.memo ? ` ・${table.memo}` : ''}
        </span>
      </div>
      {g.seats.map((s, i) => (
        <Seat key={i} table={table} index={i} box={s} assigning={assigning} placing={placing} occupant={occupantOf(i)} />
      ))}
    </div>
  )
}

function Seat({ table, index, box, assigning, placing, occupant }: {
  table: SeatTableData
  index: number
  box: { x: number; y: number; w: number; h: number }
  assigning: boolean
  placing: boolean
  occupant: { person: SeatPerson; warn: boolean } | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `seat-${table.id}-${index}`, disabled: !assigning })
  const wc = isWheelchairSeat(table, index)
  return (
    <div
      ref={setNodeRef}
      className={`absolute rounded-md ${isOver ? 'ring-4 ring-indigo-400 z-20' : ''} ${occupant?.warn ? 'ring-2 ring-red-500' : ''}`}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      title={wc ? '車椅子枠' : undefined}
    >
      {occupant ? (
        <SeatedPerson person={occupant.person} draggable={assigning} wcSeat={wc} />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-md border-2 border-dashed text-[11px] ${
            wc ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-300 bg-white/80 text-gray-400'
          } ${placing ? 'pointer-events-none' : ''}`}
        >
          {wc ? `♿ ${index + 1}` : index + 1}
        </div>
      )}
    </div>
  )
}

function SeatedPerson({ person, draggable, wcSeat }: { person: SeatPerson; draggable: boolean; wcSeat: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `person-${person.id}`, disabled: !draggable })
  return (
    <PersonCard
      ref={setNodeRef}
      person={person}
      compact
      wrapName
      hideWheelchairIcon={wcSeat}
      draggable={draggable}
      isDragging={isDragging}
      className={`h-full ${wcSeat ? 'ring-2 ring-pink-300' : ''}`}
      {...(draggable ? { ...listeners, ...attributes } : {})}
    />
  )
}

function UnassignedPanel({ persons, editable }: { persons: SeatPerson[]; editable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned', disabled: !editable })
  const groups = [
    { title: '♿ 車椅子の方', list: persons.filter(p => p.isWheelchair) },
    { title: 'スタッフ', list: persons.filter(p => p.role === 'STAFF' && !p.isWheelchair) },
    { title: '利用者', list: persons.filter(p => p.role !== 'STAFF' && !p.isWheelchair) },
  ]
  return (
    <div
      ref={setNodeRef}
      className={`print:hidden w-full xl:w-64 xl:shrink-0 xl:sticky xl:top-4 bg-white rounded-2xl border-2 p-4 transition-colors ${
        isOver ? 'border-red-400 bg-red-50 shadow-md' : 'border-gray-200 shadow-sm'
      }`}
    >
      <h3 className="font-bold text-gray-800">未配置 - {persons.length}名</h3>
      {editable && (
        <p className="text-xs text-gray-500 mb-2">
          長押しで席へドラッグ。座っている人の席に落とすと入れ替わります（未配置の人なら相手は未配置へ）。ここへ戻すと席を外します。
        </p>
      )}
      <div className="max-h-[320px] xl:max-h-[calc(100vh-240px)] overflow-y-auto pr-1 space-y-3 mt-2">
        {groups.map(
          g =>
            g.list.length > 0 && (
              <div key={g.title}>
                <div className="text-xs font-semibold text-gray-500 mb-1.5">
                  {g.title}（{g.list.length}名）
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-1 gap-2">
                  {g.list.map(p => (
                    <UnassignedPerson key={p.id} person={p} editable={editable} />
                  ))}
                </div>
              </div>
            )
        )}
        {persons.length === 0 && <p className="text-sm text-gray-400">全員の席が決まっています（参加者がいないときは「参加者の登録」で参加にしてください）</p>}
      </div>
    </div>
  )
}

function UnassignedPerson({ person, editable }: { person: SeatPerson; editable: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `person-${person.id}`, disabled: !editable })
  return <PersonCard ref={setNodeRef} person={person} draggable={editable} isDragging={isDragging} {...listeners} {...attributes} />
}

// ===== フォーム =====
const inputClass = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300'

function LayoutForm({ initial, saving, onSave, onCancel, onDelete }: {
  initial: SeatLayoutData | null
  saving: boolean
  onSave: (body: { name: string; width: number; height: number }) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [width, setWidth] = useState(String(initial?.width ?? 1200))
  const [height, setHeight] = useState(String(initial?.height ?? 800))
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSave({ name, width: Number(width), height: Number(height) })
      }}
      className="rounded-2xl border-2 border-rose-300 bg-white p-4 shadow-md grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end print:hidden"
    >
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">配置図の名前 *</span>
        <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="例: 焼肉店 2階" required autoFocus />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">幅（600〜3000）</span>
        <input type="number" min={600} max={3000} step={100} className={inputClass} value={width} onChange={e => setWidth(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">高さ（400〜3000）</span>
        <input type="number" min={400} max={3000} step={100} className={inputClass} value={height} onChange={e => setHeight(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !name.trim()} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {initial ? '保存' : '作成'}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} disabled={saving} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            削除
          </button>
        )}
        <button type="button" onClick={onCancel} className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
          取消
        </button>
      </div>
    </form>
  )
}

function TableForm({ table, seatedCount, saving, onSave, onDelete, onClose }: {
  table: SeatTableData
  seatedCount: (fromSeat: number) => number
  saving: boolean
  onSave: (body: Record<string, unknown>) => Promise<boolean>
  onDelete: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: table.name,
    shape: table.shape,
    seats: String(table.seats),
    wheelchairSlots: String(table.wheelchairSlots),
    memo: table.memo ?? '',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        const seats = Number(form.seats)
        const lost = seatedCount(seats)
        if (lost > 0 && !confirm(`席を減らすと、なくなる席に座っている ${lost}名は未配置に戻ります。よろしいですか？`)) return
        await onSave({ ...form, seats, wheelchairSlots: Number(form.wheelchairSlots || 0) })
      }}
      className="rounded-2xl border-2 border-rose-300 bg-white p-3 shadow-sm space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-rose-700">🍽️ テーブルの編集</span>
        <button type="button" onClick={onClose} className="text-xs text-gray-400">
          閉じる
        </button>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">名前 *</span>
        <input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} required />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">形</span>
        <select className={inputClass} value={form.shape} onChange={e => set('shape', e.target.value)}>
          {TABLE_SHAPES.map(s => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">席数（1〜{MAX_SEATS}）</span>
          <input type="number" min={1} max={MAX_SEATS} className={inputClass} value={form.seats} onChange={e => set('seats', e.target.value)} required />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">うち車椅子枠</span>
          <input type="number" min={0} max={Number(form.seats) || 0} className={inputClass} value={form.wheelchairSlots} onChange={e => set('wheelchairSlots', e.target.value)} />
        </label>
      </div>
      <p className="text-[11px] text-gray-500">車椅子枠は、席番号の大きいほうから割り当てられます（ピンクの席）。</p>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">メモ</span>
        <input className={inputClass} value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="例: 掘りごたつ" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !form.name.trim()} className="flex-1 rounded-lg bg-rose-600 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          保存
        </button>
        <button type="button" onClick={onDelete} disabled={saving} className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600">
          🗑 削除
        </button>
      </div>
    </form>
  )
}

function LandmarkForm({ landmark, saving, onSave, onDelete, onClose }: {
  landmark: SeatLandmarkData
  saving: boolean
  onSave: (body: Record<string, unknown>) => Promise<boolean>
  onDelete: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({ kind: landmark.kind, label: landmark.label, w: String(landmark.w), h: String(landmark.h) })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        await onSave({ ...form, w: Number(form.w), h: Number(form.h) })
      }}
      className="rounded-2xl border-2 border-rose-300 bg-white p-3 shadow-sm space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-rose-700">📍 目印の編集</span>
        <button type="button" onClick={onClose} className="text-xs text-gray-400">
          閉じる
        </button>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">種類</span>
        <select className={inputClass} value={form.kind} onChange={e => set('kind', e.target.value)}>
          {LANDMARK_KINDS.map(k => (
            <option key={k.key} value={k.key}>
              {k.icon} {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">表示する文字</span>
        <input className={inputClass} value={form.label} onChange={e => set('label', e.target.value)} placeholder="空欄なら種類の名前" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">幅</span>
          <input type="number" min={20} step={10} className={inputClass} value={form.w} onChange={e => set('w', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">高さ</span>
          <input type="number" min={20} step={10} className={inputClass} value={form.h} onChange={e => set('h', e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-rose-600 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          保存
        </button>
        <button type="button" onClick={onDelete} disabled={saving} className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600">
          🗑 削除
        </button>
      </div>
    </form>
  )
}
