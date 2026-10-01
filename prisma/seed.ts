import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 シードデータ投入開始...')

  // ===== 1. Trip（旅行イベント）=====
  const trip = await prisma.trip.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: '滋賀１泊旅行',
      destination: '滋賀県',
      startDate: new Date('2024-10-23T07:30:00+09:00'),
      endDate: new Date('2024-10-24T17:00:00+09:00'),
      travelFee: 44000,
      pocketMoney: 5000,
      notes: 'レストラン風月・ミシガンクルーズ・ブルーメの丘',
    },
  })
  console.log('✅ Trip作成:', trip.name)

  // ===== 2. Persons（スタッフ）=====
  const staffData = [
    { name: '杉野　恵', gender: '女', facility: 'グレイス' },
    { name: '三浦　紀夫', gender: '男', facility: 'グレイス' },
    { name: '佐藤根', gender: '女', facility: 'グレイス' },
    { name: '松本　朋之', gender: '男', facility: 'グレイス' },
    { name: '本永　大明', gender: '男', facility: 'グレイス' },
    { name: '田仲　智香子', gender: '女', facility: 'グレイス' },
    { name: '杉本　俊治', gender: '男', facility: '瓜破西' },
    { name: '岡田　洋和', gender: '男', facility: '瓜破西' },
    { name: '片山　真子', gender: '女', facility: 'グレイス', notes: '薬管理担当' },
    { name: '種村　樹子', gender: '女', facility: 'ドルチェ' },
    { name: '大平　彩', gender: '女', facility: '瓜破西' },
    { name: '明角　千明', gender: '女', facility: 'グレイス' },
    { name: '平　真弓', gender: '女', facility: 'グレイス' },
    { name: '石田', gender: '女', facility: 'グレイス' },
    { name: '真殿', gender: '男', facility: '瓜破西' },
    { name: '木村', gender: '女', facility: 'グレイス' },
    { name: '香織', gender: '女', facility: 'ドルチェ' },
  ]

  const bcrypt = require('bcryptjs')
  const defaultPassword = await bcrypt.hash('1234', 10)

  const staffPersons: Array<{ id: number; name: string }> = []
  for (const s of staffData) {
    const p = await prisma.person.upsert({
      where: { id: staffPersons.length + 1 },
      update: {},
      create: { ...s, role: 'STAFF', isAdmin: true, password: defaultPassword },
    })
    staffPersons.push({ id: p.id, name: p.name })
  }
  console.log(`✅ スタッフ ${staffPersons.length}名作成（初期パスワード: 1234）`)

  // ===== 3. Persons（利用者）=====
  const userData = [
    { name: '村山　町子', gender: '女', facility: 'グレイス' },
    { name: '照屋　留美子', gender: '女', facility: 'グレイス' },
    { name: '服部　喜美', gender: '女', facility: 'セントリビエ' },
    { name: '大谷　一彦', gender: '男', facility: 'グレイス' },
    { name: '遠藤　智則', gender: '男', facility: 'セントリビエ' },
    { name: '西川　康弘', gender: '男', facility: 'グレイス' },
    { name: '玉城　恒彦', gender: '男', facility: 'グレイス' },
    { name: '山内　恭正', gender: '男', facility: 'グレイス' },
    { name: '寺地　弘子', gender: '女', facility: 'グレイス' },
    { name: '岩橋　嘉和', gender: '男', facility: 'グレイス' },
    { name: '川﨑　喜久', gender: '男', facility: 'グレイス' },
    { name: '前田　新一', gender: '男', facility: 'グレイス' },
    { name: '川口　清', gender: '男', facility: 'セントリビエ' },
    { name: '高橋　里奈', gender: '女', facility: 'グレイス' },
    { name: '澤田　大', gender: '男', facility: 'グレイス' },
    { name: '木下　クミ子', gender: '女', facility: 'グレイス' },
    { name: '松本　祥之', gender: '男', facility: 'ドルチェ' },
    { name: '関口　隆行', gender: '男', facility: 'ドルチェ' },
    { name: '山口　純', gender: '男', facility: 'ドルチェ' },
    { name: '江口　宗克', gender: '男', facility: 'グレイス' },
    { name: '早矢仕　哲也', gender: '男', facility: 'ドルチェ' },
    { name: '毛利田　華子', gender: '女', facility: 'セントリビエ' },
    { name: '前田　香織', gender: '女', facility: 'ドルチェ' },
    { name: '小林　八重子', gender: '女', facility: '瓜破西' },
    { name: '加藤　清隆', gender: '男', facility: '瓜破西' },
    { name: '寺岡　英代', gender: '女', facility: '瓜破西' },
    { name: '新見　明日佳', gender: '女', facility: '瓜破西' },
    { name: '植田　徹志', gender: '男', facility: '瓜破西' },
    { name: '田宮　賢二', gender: '男', facility: '瓜破西' },
    { name: '菅原　博昭', gender: '男', facility: '瓜破西' },
    { name: '相沢　宗哲', gender: '男', facility: 'グレイス' },
    { name: '村山　一雄', gender: '男', facility: 'グレイス' },
    { name: '丸岡　美緒', gender: '女', facility: '瓜破西' },
    { name: '小阿見　幸子', gender: '女', facility: '瓜破西' },
    { name: '大谷　豊', gender: '男', facility: 'グレイス' },
    { name: '中村　優子', gender: '女', facility: '瓜破西' },
    { name: '椎葉　敏紀', gender: '男', facility: '瓜破西' },
    { name: '玉井　純治', gender: '男', facility: 'ドルチェ' },
    { name: '青木　武夫', gender: '男', facility: '瓜破西' },
    { name: '小川　まゆみ', gender: '女', facility: '瓜破西' },
    { name: '覚正　忠', gender: '男', facility: '瓜破西' },
    { name: '川原　恭裕', gender: '男', facility: 'ドルチェ' },
    { name: '重光　明子', gender: '女', facility: 'ドルチェ' },
    { name: '仲　幸次', gender: '男', facility: 'ドルチェ', notes: 'アルコール提供NG' },
    { name: '高田　ウメ子', gender: '女', facility: 'グレイス' },
  ]

  const userPersons: Array<{ id: number; name: string }> = []
  for (const u of userData) {
    const startId = staffPersons.length + userPersons.length + 1
    const p = await prisma.person.upsert({
      where: { id: startId },
      update: {},
      create: { ...u, role: 'USER' },
    })
    userPersons.push({ id: p.id, name: p.name })
  }
  console.log(`✅ 利用者 ${userPersons.length}名作成`)

  // ===== 4. Medication（服薬情報）=====
  // 実際のExcelには詳細なし → 代表的な利用者に架空データを投入
  const medicationData = [
    {
      personName: '村山　町子',
      meds: [
        { medicationName: 'アリセプト錠5mg', dosage: '1錠', timing: '朝食後', notes: '' },
        { medicationName: 'ランソプラゾールカプセル15mg', dosage: '1Cap', timing: '朝食前', notes: '' },
      ],
    },
    {
      personName: '大谷　一彦',
      meds: [
        { medicationName: 'リスペリドン錠1mg', dosage: '1錠', timing: '朝夕食後', notes: 'アルコール服用時は禁忌' },
        { medicationName: 'バルプロ酸ナトリウム錠200mg', dosage: '2錠', timing: '朝夕食後', notes: '' },
      ],
    },
    {
      personName: '玉城　恒彦',
      meds: [
        { medicationName: 'クロナゼパム錠0.5mg', dosage: '1錠', timing: '就寝前', notes: 'アルコール服用時は中止' },
        { medicationName: 'オランザピン錠5mg', dosage: '1錠', timing: '就寝前', notes: '' },
      ],
    },
    {
      personName: '前田　新一',
      meds: [
        { medicationName: 'アムロジピン錠5mg', dosage: '1錠', timing: '朝食後', notes: '' },
        { medicationName: 'メトホルミン塩酸塩錠250mg', dosage: '2錠', timing: '朝夕食後', notes: '' },
      ],
    },
    {
      personName: '服部　喜美',
      meds: [
        { medicationName: 'レボチロキシンナトリウム錠50μg', dosage: '1錠', timing: '朝食前30分', notes: '空腹時服用' },
      ],
    },
    {
      personName: '岩橋　嘉和',
      meds: [
        { medicationName: 'アリピプラゾール錠3mg', dosage: '2錠', timing: '朝食後', notes: '' },
        { medicationName: 'センノシド錠12mg', dosage: '1錠', timing: '就寝前', notes: '便秘時' },
      ],
    },
    {
      personName: '川﨑　喜久',
      meds: [
        { medicationName: 'フロセミド錠20mg', dosage: '1錠', timing: '朝食後', notes: '' },
        { medicationName: 'スピロノラクトン錠25mg', dosage: '1錠', timing: '朝食後', notes: '' },
      ],
    },
    {
      personName: '寺地　弘子',
      meds: [
        { medicationName: 'エスシタロプラム錠10mg', dosage: '1錠', timing: '夕食後', notes: '' },
      ],
    },
    {
      personName: '高田　ウメ子',
      meds: [
        { medicationName: 'カルバマゼピン錠100mg', dosage: '2錠', timing: '朝夕食後', notes: '眠気・めまいに注意' },
      ],
    },
    {
      personName: '仲　幸次',
      meds: [
        { medicationName: 'ハロペリドール錠0.75mg', dosage: '1錠', timing: '夕食後', notes: 'アルコール提供禁止' },
      ],
    },
    {
      personName: '遠藤　智則',
      meds: [
        { medicationName: 'ラモトリギン錠25mg', dosage: '2錠', timing: '朝夕食後', notes: '' },
      ],
    },
    {
      personName: '山内　恭正',
      meds: [
        { medicationName: 'テグレトール錠200mg', dosage: '1錠', timing: '朝食後', notes: '' },
        { medicationName: 'デパケンR錠100mg', dosage: '2錠', timing: '朝夕食後', notes: '' },
      ],
    },
  ]

  let medCount = 0
  const allPersons = [...staffPersons, ...userPersons]

  for (const item of medicationData) {
    const person = allPersons.find((p) => p.name === item.personName)
    if (!person) continue
    await prisma.medication.create({
        data: {
          personId: person.id,
          hasBreakfast: item.meds.some(m => m.timing.includes('朝')),
          hasLunch: item.meds.some(m => m.timing.includes('昼')),
          hasDinner: item.meds.some(m => m.timing.includes('夕')),
          hasSleep: item.meds.some(m => m.timing.includes('眠')),
          hasAsNeeded: item.meds.some(m => m.timing.includes('頓')),
          breakfastNote: item.meds.filter(m => m.timing.includes('朝')).map(m => m.medicationName).join(', '),
          lunchNote: item.meds.filter(m => m.timing.includes('昼')).map(m => m.medicationName).join(', '),
          dinnerNote: item.meds.filter(m => m.timing.includes('夕')).map(m => m.medicationName).join(', '),
          sleepNote: item.meds.filter(m => m.timing.includes('眠')).map(m => m.medicationName).join(', '),
          asNeededNote: item.meds.filter(m => m.timing.includes('頓')).map(m => m.medicationName).join(', '),
        },
      })
      medCount++
  }
  console.log(`✅ 服薬情報 ${medCount}件作成`)

  // ===== 5. TripParticipation（参加状況）=====
  // 利用者：全員参加
  const participatingUserNames = [
    '村山　町子', '服部　喜美', '大谷　一彦', '遠藤　智則',
    '玉城　恒彦', '山内　恭正', '寺地　弘子', '岩橋　嘉和',
    '川﨑　喜久', '前田　新一', '川口　清', '高橋　里奈',
    '澤田　大', '木下　クミ子', '松本　祥之', '関口　隆行',
    '江口　宗克', '前田　香織', '加藤　清隆', '寺岡　英代',
    '新見　明日佳', '植田　徹志', '田宮　賢二', '菅原　博昭',
    '相沢　宗哲', '村山　一雄', '小阿見　幸子', '大谷　豊',
    '椎葉　敏紀', '玉井　純治', '青木　武夫', '小川　まゆみ',
    '覚正　忠', '川原　恭裕', '重光　明子', '仲　幸次',
    '高田　ウメ子',
  ]
  const notParticipatingUserNames = [
    '照屋　留美子', '西川　康弘', '山口　純', '早矢仕　哲也',
    '毛利田　華子', '小林　八重子', '丸岡　美緒', '中村　優子',
  ]

  let partCount = 0
  for (const p of userPersons) {
    const status = participatingUserNames.includes(p.name) ? '参加'
      : notParticipatingUserNames.includes(p.name) ? '不参加' : '保留'
    await prisma.tripParticipation.create({
      data: {
        tripId: trip.id,
        personId: p.id,
        status,
        feeMethod: '経理',
        feeCollected: status === '参加',
      },
    })
    partCount++
  }

  // スタッフ全員参加
  for (const s of staffPersons) {
    await prisma.tripParticipation.create({
      data: {
        tripId: trip.id,
        personId: s.id,
        status: '参加',
        feeMethod: '経理',
        feeCollected: true,
      },
    })
    partCount++
  }
  console.log(`✅ 参加状況 ${partCount}件作成`)

  // ===== 6. Rooms（客室）=====
  const roomsData = [
    // 3階
    { roomNumber: '362', floor: 3, roomType: '洋', capacity: 3 },
    { roomNumber: '363', floor: 3, roomType: '洋', capacity: 3 },
    { roomNumber: '365', floor: 3, roomType: '和洋BF', capacity: 6, notes: '二次会会場（バリアフリー）' },
    { roomNumber: '366', floor: 3, roomType: '和洋BF', capacity: 5 },
    { roomNumber: '367', floor: 3, roomType: '和', capacity: 4 },
    { roomNumber: '368', floor: 3, roomType: '和', capacity: 4 },
    { roomNumber: '369', floor: 3, roomType: '和洋', capacity: 5 },
    // 4階
    { roomNumber: '465', floor: 4, roomType: '和洋', capacity: 3 },
    { roomNumber: '466', floor: 4, roomType: '和洋', capacity: 4 },
    { roomNumber: '467', floor: 4, roomType: '和', capacity: 5 },
    { roomNumber: '468', floor: 4, roomType: '和', capacity: 5 },
    { roomNumber: '469', floor: 4, roomType: '和洋', capacity: 5 },
  ]

  const rooms: Array<{ id: number; roomNumber: string }> = []
  for (const r of roomsData) {
    const room = await prisma.room.create({
      data: { tripId: trip.id, ...r },
    })
    rooms.push({ id: room.id, roomNumber: room.roomNumber })
  }
  console.log(`✅ 客室 ${rooms.length}室作成`)

  // ===== 7. RoomAssignment（部屋割り）=====
  // Excelデータより
  // 部屋番号: [入居者名の配列]
  const roomAssignmentsData: Record<string, string[]> = {
    '465': ['平　真弓', '石田', '服部　喜美', '重光　明子'],       // スタッフ：平・石田, 利用者：服部・重光
    '466': ['大平　彩', '種村　樹子', '新見　明日佳', '寺岡　英代', '木下　クミ子'],  // スタッフ：大平・種村, 利用者：明日佳・寺岡・木下
    '467': ['田仲　智香子', '小阿見　幸子', '高橋　里奈', '寺地　弘子', '前田　香織'],
    '468': ['真殿', '覚正　忠', '椎葉　敏紀', '仲　幸次', '村山　一雄'],
    '469': ['片山　真子', '佐藤根', '木村', '高田　ウメ子', '中村　優子', '村山　町子', '前田　香織'],
    '362': ['杉野　恵', '明角　千明', '小川　まゆみ'],             // スタッフ：杉野・明角, 利用者：小川
    '363': ['松本　朋之', '加藤　清隆', '玉井　純治'],
    '365': ['本永　大明', '菅原　博昭', '青木　武夫', '大谷　一彦', '植田　徹志', '遠藤　智則'],
    '366': ['杉本　俊治', '岡田　洋和', '川﨑　喜久', '川口　清'],
    '367': ['三浦　紀夫', '豊', '前田　新一', '岩橋　嘉和', '川原　恭裕'],
    '368': ['大谷　豊', '田宮　賢二', '山内　恭正'],
    '369': ['松本　朋之', '玉城　恒彦', '相沢　宗哲', '澤田　大', '山口　純'],
  }

  let assignCount = 0
  for (const [roomNum, personNames] of Object.entries(roomAssignmentsData)) {
    const room = rooms.find((r) => r.roomNumber === roomNum)
    if (!room) continue
    for (const name of personNames) {
      const person = allPersons.find((p) => p.name.trim() === name.trim())
      if (!person) continue
      try {
        await prisma.roomAssignment.create({
          data: {
            roomId: room.id,
            personId: person.id,
            isStaff: staffPersons.some((s) => s.id === person.id),
          },
        })
        assignCount++
      } catch {
        // 重複スキップ
      }
    }
  }
  console.log(`✅ 部屋割り ${assignCount}件作成`)

  // ===== 8. Schedule（スケジュール）=====
  const day1Schedules = [
    { timeLabel: '7:30', location: 'グレイス・瓜破西', description: '各利用者のトイレ誘導をお願いします。', assignedTo: '全員', sortOrder: 1 },
    { timeLabel: '8:00', location: 'グレイス付近に大型バス配車', description: 'グレイス集合の利用者様が乗車。乗車完了後、ひごペット前へバス移動。', sortOrder: 2 },
    { timeLabel: '8:30', location: 'ひごペット前 出発', description: '瓜破西集合の利用者様が乗車後、出発。途中でトイレ休憩あり。', sortOrder: 3 },
    { timeLabel: '10:30', location: 'レストラン風月 到着', description: 'チーム割を確認し、利用者様の昼食後の内服薬を片山から預かる。', assignedTo: '片山（薬管理）', sortOrder: 4 },
    { timeLabel: '11:00', location: '昼食開始', description: '座席は決まっていません', sortOrder: 5 },
    { timeLabel: '12:00', location: 'レストラン風月 出発', sortOrder: 6 },
    { timeLabel: '12:12', location: 'ミシガンクルーズ 到着', description: 'クルーズ船に乗船しない方は、近くのカフェで待機。松本さんが船苦手な方対応：菅原様・山内様', sortOrder: 7 },
    { timeLabel: '15:00', location: 'ミシガンクルーズ大津港 出発', description: '【全員共通】利用者様が購入されたものには、復路などでマジックで名前を記入してください。', assignedTo: '全員', sortOrder: 8 },
    { timeLabel: '15:30', location: 'ホテル 到着', description: '1. 部屋割を確認し、各利用者様の荷物をお部屋まで運ぶ。2. バイタルチェックのため、利用者様・職員は部屋で待機。', assignedTo: '全員', sortOrder: 9 },
    { timeLabel: '15:30以降', location: 'バイタルチェック', description: '4階担当：平・明角 / 3階担当：片山・佐藤根', assignedTo: '平・明角・片山・佐藤根', sortOrder: 10 },
    { timeLabel: 'バイタルチェック後', location: '入浴介助開始', description: '別紙「入浴 担当」を確認し、入浴介助を開始。', assignedTo: '別紙参照「入浴 担当」', sortOrder: 11 },
    { timeLabel: '18:00', location: '宴会場へ移動・宴会開始', description: '別紙「宴会 席順」を確認し、席への誘導をお願いします。アルコール提供NG：玉井様、仲様。夕食後の薬は、各部屋の担当者が片山から預かる。', assignedTo: '全員 / 片山（薬管理）', sortOrder: 12 },
    { timeLabel: '宴会中', location: 'トイレ清掃', description: '担当者が決まっているので、確認し清掃をお願いします。', assignedTo: '別紙参照「持ち物」', sortOrder: 13 },
    { timeLabel: '【重要】', location: '（眠前薬について）', description: 'アルコールを飲まれる眠前薬のある方は、服薬を中止してください。', assignedTo: '全員', sortOrder: 14 },
    { timeLabel: '20:00', location: '宴会終了', description: '各自部屋に戻る。365号室で二次会を実施（希望者のみ）。', sortOrder: 15 },
    { timeLabel: '【重要】', location: '（夜間の行動）', description: 'ホテルの外に出るのは禁止です。', assignedTo: '全員', sortOrder: 16 },
  ]

  const day2Schedules = [
    { timeLabel: '7:30〜9:00', location: '朝食', description: '各部屋のスタッフはこの時間内に朝食を済ませてください（自由に時間を取ってOK）。', assignedTo: '各部屋担当者', sortOrder: 1 },
    { timeLabel: '16:10', location: 'グレイス付近に停車', description: 'グレイスから出発したスタッフはここで下車し、荷物と利用者様をグレイスまで送ってください。', assignedTo: 'グレイス出発スタッフ', sortOrder: 2 },
    { timeLabel: '16:40', location: 'ひごペット前に停車', description: '瓜破西から出発したスタッフはここで下車し、荷物と利用者様を瓜破西までお送りください。', assignedTo: '瓜破西出発スタッフ', sortOrder: 3 },
  ]

  for (const s of day1Schedules) {
    await prisma.schedule.create({ data: { tripId: trip.id, dayNo: 1, ...s } })
  }
  for (const s of day2Schedules) {
    await prisma.schedule.create({ data: { tripId: trip.id, dayNo: 2, ...s } })
  }
  console.log(`✅ スケジュール ${day1Schedules.length + day2Schedules.length}件作成`)

  // ===== 9. BathingAssignment（入浴担当）=====
  const bathingData: Array<{ name: string; category: string }> = [
    // 女風呂・介助
    { name: '木村', category: '介助_女' },
    { name: '田仲　智香子', category: '外介助_女' },
    { name: '石田', category: '外介助_女' },
    { name: '明角　千明', category: 'バイタル案内_4F' },
    { name: '平　真弓', category: 'バイタル案内_4F' },
    // 男風呂・介助
    { name: '松本　朋之', category: '介助_男' },
    { name: '岡田　洋和', category: '介助_男' },
    { name: '杉本　俊治', category: '外介助_男' },
    { name: '真殿', category: '外介助_男' },
    { name: '片山　真子', category: 'バイタル案内_3F' },
    { name: '佐藤根', category: 'バイタル案内_3F' },
    // 利用者・入浴自立（女）
    { name: '木下　クミ子', category: '自立_女' },
    { name: '小阿見　幸子', category: '自立_女' },
    { name: '高橋　里奈', category: '自立_女' },
    { name: '小川　まゆみ', category: '自立_女' },
    { name: '中村　優子', category: '自立_女' },
    // 利用者・入浴自立（男）
    { name: '前田　新一', category: '自立_男' },
    { name: '松本　祥之', category: '自立_男' },
    { name: '玉城　恒彦', category: '自立_男' },
    { name: '川﨑　喜久', category: '自立_男' },
    { name: '山内　恭正', category: '自立_男' },
    { name: '椎葉　敏紀', category: '自立_男' },
    { name: '川口　清', category: '自立_男' },
    { name: '澤田　大', category: '自立_男' },
    { name: '仲　幸次', category: '自立_男' },
    { name: '遠藤　智則', category: '自立_男' },
    { name: '大谷　一彦', category: '自立_男' },
    { name: '田宮　賢二', category: '自立_男' },
    // 部屋風呂
    { name: '村山　町子', category: '部屋風呂' },
    { name: '本永　大明', category: '部屋風呂' },
    { name: '加藤　清隆', category: '部屋風呂' },
    { name: '玉井　純治', category: '部屋風呂' },
  ]

  let bathCount = 0
  for (const b of bathingData) {
    const person = allPersons.find((p) => p.name.trim() === b.name.trim())
    if (!person) continue
    try {
      await prisma.bathingAssignment.create({
        data: { tripId: trip.id, personId: person.id, category: b.category },
      })
      bathCount++
    } catch {
      // 重複スキップ
    }
  }
  console.log(`✅ 入浴担当 ${bathCount}件作成`)

  // ===== 10. PocketMoneyRecord（小遣い精算）=====
  const pocketData: Array<{ name: string; allocated: number; used: number }> = [
    { name: '村山　町子', allocated: 5000, used: 3770 },
    { name: '服部　喜美', allocated: 5000, used: 3364 },
    { name: '大谷　一彦', allocated: 5000, used: 1880 },
    { name: '遠藤　智則', allocated: 5000, used: 4731 },
    { name: '玉城　恒彦', allocated: 5000, used: 3850 },
    { name: '山内　恭正', allocated: 5000, used: 4930 },
    { name: '寺地　弘子', allocated: 5000, used: 4782 },
    { name: '岩橋　嘉和', allocated: 5000, used: 3400 },
    { name: '川﨑　喜久', allocated: 5000, used: 5000 },
    { name: '前田　新一', allocated: 5000, used: 3170 },
    { name: '川口　清', allocated: 5000, used: 4665 },
    { name: '高橋　里奈', allocated: 5000, used: 3308 },
    { name: '澤田　大', allocated: 5000, used: 4456 },
    { name: '木下　クミ子', allocated: 5000, used: 4313 },
    { name: '松本　祥之', allocated: 5000, used: 3680 },
    { name: '前田　香織', allocated: 5000, used: 2547 },
    { name: '加藤　清隆', allocated: 5000, used: 1990 },
    { name: '寺岡　英代', allocated: 5000, used: 4730 },
    { name: '新見　明日佳', allocated: 5000, used: 2740 },
    { name: '植田　徹志', allocated: 5000, used: 1160 },
    { name: '田宮　賢二', allocated: 5000, used: 3870 },
    { name: '菅原　博昭', allocated: 5000, used: 1330 },
    { name: '相沢　宗哲', allocated: 5000, used: 1930 },
    { name: '村山　一雄', allocated: 5000, used: 4981 },
    { name: '大谷　豊', allocated: 5000, used: 4869 },
    { name: '椎葉　敏紀', allocated: 5000, used: 4300 },
    { name: '玉井　純治', allocated: 5000, used: 4853 },
    { name: '青木　武夫', allocated: 5000, used: 5000 },
    { name: '小川　まゆみ', allocated: 5000, used: 5000 },
    { name: '川原　恭裕', allocated: 5000, used: 5000 },
    { name: '覚正　忠', allocated: 5000, used: 5000 },
    { name: '重光　明子', allocated: 5000, used: 400 },
    { name: '高田　ウメ子', allocated: 5000, used: 400 },
    { name: '仲　幸次', allocated: 5000, used: 4393 },
  ]

  let pmCount = 0
  for (const pm of pocketData) {
    const person = allPersons.find((p) => p.name.trim() === pm.name.trim())
    if (!person) continue
    try {
      await prisma.pocketMoneyRecord.create({
        data: {
          tripId: trip.id,
          personId: person.id,
          allocated: pm.allocated,
          used: pm.used,
          remaining: pm.allocated - pm.used,
        },
      })
      pmCount++
    } catch {
      // 重複スキップ
    }
  }
  console.log(`✅ 小遣い精算 ${pmCount}件作成`)

  // ===== 11. SupplyItems（持ち物）=====
  const supplyData = [
    { itemName: 'グローブ', quantity: '各スタッフ分', facility: 'グレイス' },
    { itemName: '箱ティッシュ', quantity: '各スタッフ分', facility: 'グレイス' },
    { itemName: '着替え', quantity: '必要分', facility: 'グレイス' },
    { itemName: 'キッチンバサミ', quantity: '6本', facility: 'グレイス' },
    { itemName: 'オムツ', quantity: '必要分', facility: 'グレイス' },
    { itemName: 'パット（小・大）', quantity: '必要分', facility: 'グレイス' },
    { itemName: 'パット（フラット）', quantity: '必要分', facility: 'グレイス' },
    { itemName: '食後薬', quantity: '各利用者分', facility: 'グレイス', category: '薬' },
    { itemName: 'ゴミ袋（小）', quantity: '各スタッフ分', facility: 'グレイス' },
    { itemName: '各利用者の薬（瓜西HS）', quantity: '利用者分', facility: '瓜破西', category: '薬', notes: '岡田担当' },
    { itemName: '各利用者の薬（瓜西CH）', quantity: '利用者分', facility: '瓜破西', category: '薬', notes: '大平担当' },
    { itemName: '各利用者の薬（グレイス）', quantity: '利用者分', facility: 'グレイス', category: '薬', notes: '片山担当' },
    { itemName: '各利用者の薬（ドルチェ）', quantity: '利用者分', facility: 'ドルチェ', category: '薬', notes: '種村担当' },
  ]

  for (const s of supplyData) {
    await prisma.supplyItem.create({
      data: { tripId: trip.id, ...s },
    })
  }
  console.log(`✅ 持ち物 ${supplyData.length}件作成`)

  console.log('\n🎉 全シードデータ投入完了！')
  console.log(`  Trip: 1件`)
  console.log(`  Person: ${staffPersons.length + userPersons.length}名（スタッフ${staffPersons.length}名・利用者${userPersons.length}名）`)
  console.log(`  Medication: ${medCount}件`)
  console.log(`  TripParticipation: ${partCount}件`)
  console.log(`  Room: ${rooms.length}室`)
  console.log(`  RoomAssignment: ${assignCount}件`)
  console.log(`  Schedule: ${day1Schedules.length + day2Schedules.length}件`)
  console.log(`  BathingAssignment: ${bathCount}件`)
  console.log(`  PocketMoneyRecord: ${pmCount}件`)
  console.log(`  SupplyItem: ${supplyData.length}件`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
