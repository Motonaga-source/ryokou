export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { resolveTripId } from '@/lib/event'
import { loadSeating } from '@/lib/seating-server'

// GET /api/seating  選択中のイベントの席レイアウト（配置図・テーブル・目印・割り当て・参加者）
export async function GET(request: Request) {
  const tripId = await resolveTripId(request)
  return NextResponse.json(await loadSeating(tripId))
}
