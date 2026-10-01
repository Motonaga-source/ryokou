export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.car.delete({
    where: { id: parseInt(id) }
  })
  return NextResponse.json({ success: true })
}
