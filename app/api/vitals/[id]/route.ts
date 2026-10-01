import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT /api/vitals/[id]
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const vital = await prisma.vitalRecord.update({
    where: { id: parseInt(id) },
    data: {
      bloodPressureHigh: body.bloodPressureHigh ? parseInt(body.bloodPressureHigh) : null,
      bloodPressureLow: body.bloodPressureLow ? parseInt(body.bloodPressureLow) : null,
      pulse: body.pulse ? parseInt(body.pulse) : null,
      temperature: body.temperature ? parseFloat(body.temperature) : null,
      notes: body.notes,
    },
  })
  return NextResponse.json(vital)
}
