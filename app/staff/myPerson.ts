// 「自分の担当」で選んだ人のIDを端末（localStorage）に記憶する
const STORAGE_KEY = 'my-person-id'

export function readMyPersonId(): number | null {
  try {
    const id = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function saveMyPersonId(id: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    // 保存できない環境では毎回選び直してもらう
  }
}

export function clearMyPersonId() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 何もしない
  }
}
