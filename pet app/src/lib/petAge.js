// 寵物年齡（以生日即時計算，不存進資料庫，所以會隨時間自動增加）
// 以「實際滿幾個月」計算，不用「天數 ÷ 30.4」估算。

function toYMD(value) {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() }
  }

  // 'YYYY-MM-DD' 或 ISO 字串：只取日期部分（與頁面其他地方 slice(0, 10) 的作法一致）
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

// 滿幾個月；沒有生日回傳 null
export function ageInMonths(birthDate, refDate = new Date()) {
  const b = toYMD(birthDate)
  const r = toYMD(refDate)
  if (!b || !r) return null

  let months = (r.y - b.y) * 12 + (r.m - b.m)
  if (r.d < b.d) months -= 1

  return Math.max(months, 0)
}

// 月數 → 文字：未滿 1 個月 / N 個月 / N 歲 / N 歲 M 個月
export function formatAge(months) {
  if (months === null || months === undefined) return null
  if (months < 1) return '未滿 1 個月'
  if (months < 12) return `${months} 個月`

  const years = Math.floor(months / 12)
  const rest = months % 12

  return rest ? `${years} 歲 ${rest} 個月` : `${years} 歲`
}

// 直接由生日取得年齡文字；沒有生日回傳 null
export function petAgeText(birthDate) {
  return formatAge(ageInMonths(birthDate))
}
