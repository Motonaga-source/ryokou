export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { resolveTripId } from '@/lib/event'
import { loadTransport } from '@/lib/transport-server'

// GET /api/transport  選択中のイベントの送迎表（拠点・枠・割り当て・参加者と送迎メモ）
export async function GET(request: Request) {
  const tripId = await resolveTripId(request)
  return NextResponse.json(await loadTransport(tripId))
}
