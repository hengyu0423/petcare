// 寵物頁面用的計算：生命階段、人類年齡、生日倒數、體重趨勢、成長曲線的資料。
// 全部是純函式（日期一律用 'YYYY-MM-DD' 字串，以日曆日期計算，不受時區、夏令時間影響）。

import { ageInMonths } from './petAge'

// 與飲食計畫（後端 services/mealPlan.js）相同的分界：
// 未滿 12 個月 = 幼年，滿 84 個月（7 歲）= 高齡。兩邊改的時候要一起改。
export const YOUNG_MONTHS = 12
export const SENIOR_MONTHS = 84

const DAY_MS = 24 * 60 * 60 * 1000
const AVG_MONTH_DAYS = 30.4375

// ---------- 日期小工具 ----------

function parseYMD(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null
}

function utcDay(ymd) {
  return Date.UTC(ymd.y, ymd.m - 1, ymd.d)
}

export function todayString(now = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

// b 比 a 晚幾天（可以是負數）；任一邊無法解析回傳 null
export function daysBetween(a, b) {
  const x = parseYMD(a), y = parseYMD(b)
  if (!x || !y) return null
  return Math.round((utcDay(y) - utcDay(x)) / DAY_MS)
}

export function formatKg(n) {
  const v = Number(n)
  return Number.isFinite(v) ? String(Number(v.toFixed(2))) : '—'
}

// ---------- 生命階段 / 人類年齡（只有貓、狗有通用的參考標準）----------

const STAGES = {
  young: { key: 'young', label: '幼年', emoji: '🍼', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  adult: { key: 'adult', label: '成年', emoji: '🌿', cls: 'bg-green-50 text-green-700 border-green-200' },
  senior: { key: 'senior', label: '高齡', emoji: '🧓', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
}

export const isCatOrDog = species => species === 'cat' || species === 'dog'

export function lifeStage(species, months) {
  if (!isCatOrDog(species) || months === null || months === undefined) return null
  if (months < YOUNG_MONTHS) return STAGES.young
  if (months >= SENIOR_MONTHS) return STAGES.senior
  return STAGES.adult
}

// 常見的概略換算：第 1 年 ≈ 15 歲、第 2 年再 +9（共 24），之後貓每年 +4、狗每年 +5。
// 狗的體型差異很大，所以只當參考。
export function humanAgeYears(species, months) {
  if (!isCatOrDog(species) || months === null || months === undefined) return null
  let years
  if (months <= 12) years = (months / 12) * 15
  else if (months <= 24) years = 15 + ((months - 12) / 12) * 9
  else years = 24 + ((months - 24) / 12) * (species === 'cat' ? 4 : 5)
  return Math.round(years)
}

// ---------- 生日倒數 ----------

// 回傳 { date, daysUntil, turning, isToday }；沒有生日、或生日在未來回傳 null
export function nextBirthday(birthDate, today = todayString()) {
  const b = parseYMD(birthDate), t = parseYMD(today)
  if (!b || !t) return null
  if (utcDay(b) > utcDay(t)) return null

  const pad = n => String(n).padStart(2, '0')
  const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const on = year => {
    // 2/29 出生的寵物，非閏年改在 2/28 慶祝
    const day = b.m === 2 && b.d === 29 && !isLeap(year) ? 28 : b.d
    return { y: year, m: b.m, d: day }
  }

  let next = on(t.y)
  if (utcDay(next) < utcDay(t)) next = on(t.y + 1)

  const daysUntil = Math.round((utcDay(next) - utcDay(t)) / DAY_MS)
  const turning = next.y - b.y
  if (turning < 1) return null // 出生的那一年，還沒有「生日」

  return {
    date: `${next.y}-${pad(next.m)}-${pad(next.d)}`,
    daysUntil,
    turning,
    isToday: daysUntil === 0
  }
}

// ---------- 體重趨勢 ----------

// records：依日期由舊到新 [{ weight, measured_on }]
// 與「最新一筆」比較的基準 = 最新一筆往前 windowDays 天當天或之前最近的一筆；
// 沒有那麼久的資料就用最早的一筆（至少相隔 minSpanDays 天才有意義）。
export function weightTrend(records, { windowDays = 30, minSpanDays = 7 } = {}) {
  if (!Array.isArray(records) || records.length < 2) return null

  const latest = records[records.length - 1]
  let base = null

  for (let i = records.length - 2; i >= 0; i--) {
    const gap = daysBetween(records[i].measured_on, latest.measured_on)
    if (gap !== null && gap >= windowDays) { base = records[i]; break }
  }
  if (!base) base = records[0]

  const spanDays = daysBetween(base.measured_on, latest.measured_on)
  if (spanDays === null || spanDays < minSpanDays) return null

  const delta = Math.round((latest.weight - base.weight) * 100) / 100
  const pct = base.weight > 0 ? (delta / base.weight) * 100 : 0

  return { from: base.weight, to: latest.weight, delta, pct, spanDays }
}

// 非診斷：只提醒「變化偏快」。幼年本來就在長，不提醒。
export function weightNote(trend, stage) {
  if (!trend || stage?.key === 'young') return null

  const abs = Math.abs(trend.pct)
  const dir = trend.delta > 0 ? '增加' : '減少'
  const pctText = `${abs.toFixed(1)}%`

  if (abs >= 10) {
    return {
      level: 'warning',
      text: `最近 ${trend.spanDays} 天體重${dir}了 ${pctText}，變化偏快。建議留意飲食與活動量，如果同時食慾或精神有改變，請諮詢獸醫。`
    }
  }
  if (abs >= 5) {
    return {
      level: 'info',
      text: `最近 ${trend.spanDays} 天體重${dir}了 ${pctText}，可以繼續觀察。`
    }
  }
  return null
}

// ---------- 成長曲線資料 ----------

const ageMonthsAt = (birthDate, date) => {
  const gap = daysBetween(birthDate, date)
  return gap === null ? null : gap / AVG_MONTH_DAYS
}

export function formatAgeAxis(months) {
  if (months < 24) return `${Math.round(months)}個月`
  const y = months / 12
  return `${Number(y.toFixed(1))}歲`
}

// 回傳 { points, xDomain, yDomain, ticks?, areas }
//   mode 'date'：x = 日期（當天 00:00 UTC 的毫秒數）
//   mode 'age' ：x = 出生後的月數（需要有生日；生日之前的點會被略過），並附上幼年／成年／高齡的區間
export function buildChart(records, { mode = 'date', birthDate = null } = {}) {
  const list = Array.isArray(records) ? records : []

  let points = list
    .map(r => {
      const ymd = parseYMD(r.measured_on)
      if (!ymd) return null
      const x = mode === 'age' ? ageMonthsAt(birthDate, r.measured_on) : utcDay(ymd)
      return x === null || (mode === 'age' && x < 0)
        ? null
        : { x, weight: r.weight, date: r.measured_on, note: r.note || '', id: r.id }
    })
    .filter(Boolean)
    .sort((a, b) => a.x - b.x)

  if (points.length === 0) return { points: [], xDomain: [0, 1], yDomain: [0, 1], areas: [] }

  const ws = points.map(p => p.weight)
  const min = Math.min(...ws), max = Math.max(...ws)
  const pad = Math.max((max - min) * 0.2, max * 0.05, 0.1)
  const yDomain = [
    Math.max(0, Math.floor((min - pad) * 10) / 10),
    Math.ceil((max + pad) * 10) / 10
  ]

  const xs = points.map(p => p.x)
  let lo = Math.min(...xs), hi = Math.max(...xs)

  if (mode === 'age') {
    // 只有一個點或點很擠時，把範圍撐開，曲線才看得到
    hi = Math.max(hi + 1, lo + 6)
    lo = Math.max(0, lo - 1)
    const areas = [
      { key: 'young', label: '幼年', from: 0, to: YOUNG_MONTHS },
      { key: 'adult', label: '成年', from: YOUNG_MONTHS, to: SENIOR_MONTHS },
      { key: 'senior', label: '高齡', from: SENIOR_MONTHS, to: Infinity }
    ]
      .map(a => ({ ...a, from: Math.max(a.from, lo), to: Math.min(a.to, hi) }))
      .filter(a => a.to > a.from)

    return { points, xDomain: [lo, hi], yDomain, ticks: ageTicks(lo, hi), areas }
  }

  if (hi - lo < 14 * DAY_MS) { // 只有一個點或同一兩週內：前後各留半個月
    lo -= 15 * DAY_MS
    hi += 15 * DAY_MS
  }
  return { points, xDomain: [lo, hi], yDomain, areas: [] }
}

// 年齡軸刻度：範圍小就每 3 個月一格，範圍大每年／每兩年一格
export function ageTicks(lo, hi) {
  const span = hi - lo
  const step = span <= 18 ? 3 : span <= 48 ? 6 : span <= 120 ? 12 : 24
  const ticks = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(t)
  return ticks
}

// 方便頁面用：由生日算出月齡（無生日 null）
export { ageInMonths }