export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId = parseInt(searchParams.get('tripId') || '1')

    // Fetch all data
    const persons = await prisma.person.findMany({
      include: {
        medication: true,
        busAssignments: { where: { tripId } },
        carAssignments: { include: { car: true } }
      },
      orderBy: { facility: 'asc' }
    })

    const rooms = await prisma.room.findMany({
      where: { tripId },
      include: {
        assignments: {
          include: { person: true }
        }
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }]
    })

    // Prepare sheets
    const wb = XLSX.utils.book_new()

    // 1. 名簿
    const personsData = persons.map(p => ({
      ID: p.id,
      氏名: p.name,
      性別: p.gender || '',
      種別: p.role === 'STAFF' ? 'スタッフ' : '利用者',
      施設: p.facility || '',
      車椅子: p.isWheelchair ? 'あり' : 'なし',
      備考: p.notes || ''
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(personsData), '名簿')

    // 2. 部屋割り
    const roomsData = rooms.flatMap(r => 
      r.assignments.map(a => ({
        フロア: r.floor + 'F',
        部屋番号: r.roomNumber,
        氏名: a.person.name,
        種別: a.person.role === 'STAFF' ? 'スタッフ' : '利用者'
      }))
    )
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roomsData), '部屋割り')

    // 3. バス
    const busData = persons.flatMap(p => 
      p.busAssignments.map(a => ({
        車両: a.vehicle,
        列: a.rowNo,
        座席: a.seatSide,
        氏名: p.name,
        車椅子: p.isWheelchair ? 'あり' : ''
      }))
    ).sort((a, b) => {
      if (a.車両 !== b.車両) return (a.車両 || '').localeCompare(b.車両 || '')
      if (a.列 !== b.列) return (a.列 || 0) - (b.列 || 0)
      return (a.座席 || '').localeCompare(b.座席 || '')
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(busData), 'バス')

    // 4. 乗用車
    const carData = persons.flatMap(p => 
      p.carAssignments.map(a => ({
        車両: a.car.name,
        氏名: p.name,
        車椅子: p.isWheelchair ? 'あり' : ''
      }))
    )
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(carData), '乗用車')

    // 5. 服薬
    const medsData = persons.filter(p => p.medication).map(p => ({
      氏名: p.name,
      施設: p.facility || '',
      朝食後: p.medication?.hasBreakfast ? 'あり' : '',
      朝_備考: p.medication?.breakfastNote || '',
      昼食後: p.medication?.hasLunch ? 'あり' : '',
      昼_備考: p.medication?.lunchNote || '',
      夕食後: p.medication?.hasDinner ? 'あり' : '',
      夕_備考: p.medication?.dinnerNote || '',
      眠前: p.medication?.hasSleep ? 'あり' : '',
      眠_備考: p.medication?.sleepNote || '',
      頓服: p.medication?.hasAsNeeded ? 'あり' : '',
      頓服_備考: p.medication?.asNeededNote || ''
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(medsData), '服薬情報')

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Disposition': 'attachment; filename="ryoko_data.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Excel generation failed' }, { status: 500 })
  }
}
