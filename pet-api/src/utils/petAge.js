// ======================================================
// 寵物年齡（以生日即時計算，不存進資料庫，所以會隨時間自動增加）
//
// 以「實際滿幾個月」計算（依日曆），不用「天數 ÷ 30.4」估算，
// 避免老寵物差好幾天、或生日當天沒有跳到下一歲。
// ======================================================

const TZ = process.env.APP_TIMEZONE || 'Asia/Taipei'

// 接受 'YYYY-MM-DD'、ISO 字串或 Date，回傳 { y, m, d }；無法解析回傳 null
function toYMD(value) {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return {
      y: value.getFullYear(),
      m: value.getMonth() + 1,
      d: value.getDate()
    }
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

// 今天的日期（以 APP_TIMEZONE 為準）
function todayYMD() {
  return toYMD(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  )
}

// 滿幾個月；沒有生日回傳 null；生日在未來回傳 0
function ageInMonths(birthDate, refDate) {
  const b = toYMD(birthDate)
  if (!b) return null

  const r = toYMD(refDate) || todayYMD()

  let months = (r.y - b.y) * 12 + (r.m - b.m)
  if (r.d < b.d) months -= 1

  return Math.max(months, 0)
}

// 月數 → 文字：未滿 1 個月 / N 個月 / N 歲 / N 歲 M 個月
function formatAge(months) {
  if (months === null || months === undefined) return null
  if (months < 1) return '未滿 1 個月'
  if (months < 12) return `${months} 個月`

  const years = Math.floor(months / 12)
  const rest = months % 12

  return rest ? `${years} 歲 ${rest} 個月` : `${years} 歲`
}

module.exports = { ageInMonths, formatAge }
