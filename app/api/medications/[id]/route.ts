export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE /api/medications/[id] - 旧仕様のルートは不要だが念のため残す（何もしない）
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  // 新仕様では /api/medications (PUT) で管理するため、このルートは使用しない
  return NextResponse.json({ success: true })
}
