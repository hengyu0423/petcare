// =====================================================
// 樂觀顯示（optimistic UI）用的工具
//
// 送出訊息時，使用者的問題與 AI 的回覆要「立刻」顯示在畫面上，
// 不用等存進資料庫、重新讀取之後才出現。
//
// 暫時顯示的訊息（pending）會在資料庫的紀錄「多出一筆相同內容」時自動隱藏，
// 所以不會重複顯示；判斷方式是比較「相同角色＋相同內容」的數量，
// 不依賴時間，所以不怕電腦與伺服器的時鐘有誤差。
// =====================================================

// 太舊的暫時訊息一定清掉（例如存檔失敗、一直追不上資料庫）
export const PENDING_MAX_AGE_MS = 120000

export function countSame(list, role, content) {
  return list.filter(
    m => m.role === role && m.content === content
  ).length
}

// 建立一則暫時訊息；base = 建立當下，畫面上已有幾則相同的
export function makePending({ kind, petId, role, content, severity = null, sources = [], visibleMessages, now = Date.now() }) {
  return {
    key: `pending-${kind}-${now}`,
    petId,
    role,
    content,
    severity,
    sources,
    at: now,
    base: countSame(visibleMessages, role, content)
  }
}

// 畫面上要顯示的訊息：資料庫的紀錄 + 還沒被資料庫追上的暫時訊息（依建立順序）
export function mergeMessages(messages, pending, petId) {
  const visible = pending.filter(
    p =>
      p.petId === petId &&
      countSame(messages, p.role, p.content) <= p.base
  )

  return [...messages, ...visible]
}

// 清掉資料庫已經追上的、或太舊的暫時訊息；沒有變化時回傳同一個陣列（避免多餘的重新渲染）
export function prunePending(list, messages, petId, now = Date.now()) {
  const next = list.filter(
    p =>
      now - p.at < PENDING_MAX_AGE_MS &&
      (p.petId !== petId ||
        countSame(messages, p.role, p.content) <= p.base)
  )

  return next.length === list.length ? list : next
}
