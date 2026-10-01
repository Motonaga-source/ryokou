export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request) {
  const body = await request.json()
  // body: { personId: number, teamId: number | null }

  // 既存のチーム所属を削除
  await prisma.teamMember.deleteMany({
    where: { personId: body.personId }
  })

  // 新しいチームが指定されていれば追加
  if (body.teamId) {
    const membership = await prisma.teamMember.create({
      data: {
        personId: body.personId,
        teamId: body.teamId,
        isLeader: false,
      }
    })
    return NextResponse.json(membership)
  }

  return NextResponse.json({ success: true })
}
