/* eslint-disable @typescript-eslint/no-require-imports */
// 指定した env ファイルの DATABASE_URL / DIRECT_URL で後ろのコマンドを実行する（開発用 DB で作業するため）
// 使い方: node scripts/with-env.cjs .env.dev npx prisma db push
//         npm run dev-db -- npx prisma db push
// 実行前に接続先のホスト名を表示する。本番の接続先（.env と同じ）を指していたら中止する
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const [envFile, ...command] = process.argv.slice(2)
if (!envFile || command.length === 0) {
  console.error('使い方: node scripts/with-env.cjs <envファイル> <コマンド...>')
  process.exit(1)
}

const parse = file => {
  const vars = {}
  for (const line of fs.readFileSync(path.resolve(file), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/)
    if (m) vars[m[1]] = m[2]
  }
  return vars
}

const vars = parse(envFile)
const host = url => (url ? new URL(url).hostname.split('.')[0].replace('-pooler', '') : '(なし)')
const target = host(vars.DATABASE_URL)
const production = fs.existsSync('.env') ? host(parse('.env').DATABASE_URL) : null

if (path.basename(envFile) !== '.env' && target === production) {
  console.error(`中止: ${envFile} の接続先（${target}）が本番（.env）と同じです`)
  process.exit(1)
}

console.log(`[with-env] ${envFile} → 接続先 ${target}${target === production ? '（本番）' : ''}`)
const result = spawnSync(command[0], command.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...vars },
})
process.exit(result.status ?? 1)
