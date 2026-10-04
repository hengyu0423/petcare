// ======================================================
// 飲食洞察（Diet Insights）
//
// 這個模組被三個地方共用，確保判斷邏輯一致：
//   1. /food/check-food      → 選擇食物時的「健康歷史警訊」
//   2. /feeding/.../diet-alerts → 飲食管理頁面的「飲食異常警訊」
//   3. /ai/weekly-report     → 週報
//
// 只使用既有資料表：health_records、feeding_records、food_items、pets。
// 所有輸出都是「提醒／建議」，不是醫療診斷。
// ======================================================

const pool = require('../db')
const { ageInMonths } = require('../utils/petAge')

const TZ = process.env.APP_TIMEZONE || 'Asia/Taipei'

// ------------------------------------------------------
// 可調整的門檻（集中在這裡，方便日後微調）
// ------------------------------------------------------
const CFG = {
  // ---- 分析窗口與資料量：避免只因單次餵食就產生警訊 ----
  windowDays: 7,
  minRecords: 5, // 至少 5 筆有效紀錄
  minDays: 3, // 且分布在至少 3 個不同日子
  minCalorieDays: 3, // 熱量判斷：至少 3 個「已完成」的日子

  // ---- 明顯輸入錯誤的紀錄：排除在分析之外，另外提醒確認 ----
  maxPlausibleAmountG: 2000,
  maxPlausibleKcal: 5000,

  // ---- 食物集中 ----
  dominanceShare: 0.6, // 單一非主食食物佔 60% 以上
  dominanceMinDays: 3,
  snackShare: 0.2, // 零食佔 20% 以上（一般建議約 10% 以內）
  stapleMinShare: 0.4, // 主食（乾糧／主食罐）低於 40%

  // ---- 熱量：以 RER × 活動係數 粗估「一般需求」，再看倍數 ----
  merFactor: { cat: 1.2, dog: 1.6 },
  calorieHighRatio: 1.5,
  calorieLowRatio: 0.5,
  weightRangeKg: [0.5, 90],
  youngMonths: 12, // 幼年寵物需求變動大，不做熱量判斷

  // ---- 營養比例（占「蛋白質＋脂肪＋碳水」熱量的比例）----
  minMacroRecords: 5,
  fatShareHigh: 0.6,
  carbShareHigh: 0.6,
  proteinShareLow: { cat: 0.2, dog: 0.15, default: 0.15 },

  // ---- 健康歷史警訊 ----
  healthLookbackDays: 7,

  // 「高脂肪食物」的判斷門檻（每 100g 脂肪克數）。
  // 與 food.js 的 DIET_RULES.veryHighFat 一致，而不是 highFat(12)：
  // 一般乾糧的脂肪本來就常在 12–18%，用 12 會把乾糧也當成高脂肪食物而誤報。
  highFatPer100g: 18,

  // 乾糧／主食罐的高脂肪門檻（一般乾糧不會超過這個值）
  stapleHighFatPer100g: 25
}

const STAPLE_CATEGORIES = new Set(['dry', 'wet'])
const GI_EVENT_TYPES = new Set(['vomiting', 'diarrhea'])

const SEVERITY_LABEL = {
  normal: '一般',
  urgent: '建議儘快就醫',
  emergency: '緊急'
}

// ======================================================
// 共用小工具
// ======================================================

function num(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function round(value, digits = 0) {
  const p = 10 ** digits
  return Math.round(value * p) / p
}

function pct(value) {
  return Math.round(value * 100)
}

function speciesKey(species) {
  const s = String(species || '').toLowerCase()
  if (/cat|貓/.test(s)) return 'cat'
  if (/dog|狗|犬/.test(s)) return 'dog'
  return null
}

function normName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

function dayDiff(fromStr, toStr) {
  const [y1, m1, d1] = String(fromStr).slice(0, 10).split('-').map(Number)
  const [y2, m2, d2] = String(toStr).slice(0, 10).split('-').map(Number)
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000
  )
}

async function ownsPet(petId, userId) {
  const result = await pool.query(
    'SELECT id FROM pets WHERE id = $1 AND owner_id = $2',
    [petId, userId]
  )
  return result.rows.length > 0
}

// ======================================================
// A. 健康歷史：取得與飲食有關的健康事件
// ======================================================

const EVENT_COLUMNS = `
  id, type, title, description, severity, source, diet_info,
  to_char(date, 'YYYY-MM-DD') AS date_str,
  to_char(diet_until, 'YYYY-MM-DD') AS diet_until_str
`

// 近期事件：事件日期在最近 N 天內，或飲食注意期尚未結束
async function getRecentDietEvents(petId, { days = CFG.healthLookbackDays } = {}) {
  const result = await pool.query(
    `
    SELECT
      ${EVENT_COLUMNS},
      ((NOW() AT TIME ZONE $3::text)::date - date) AS days_ago,
      (diet_until IS NOT NULL
        AND diet_until >= (NOW() AT TIME ZONE $3::text)::date
      ) AS is_active
    FROM health_records
    WHERE pet_id = $1
      AND diet_relevant = TRUE
      AND (
        date >= (NOW() AT TIME ZONE $3::text)::date - $2::int
        OR diet_until >= (NOW() AT TIME ZONE $3::text)::date
      )
    ORDER BY is_active DESC, date DESC, id DESC
    `,
    [petId, days, TZ]
  )
  return result.rows
}

// 某段期間內有效的事件（週報用）：事件發生在期間內，或飲食注意期延續到期間內
async function getDietEventsInRange(petId, startDate, endDate) {
  const result = await pool.query(
    `
    SELECT
      ${EVENT_COLUMNS},
      (diet_until IS NOT NULL
        AND diet_until >= (NOW() AT TIME ZONE $4::text)::date
      ) AS is_active
    FROM health_records
    WHERE pet_id = $1
      AND diet_relevant = TRUE
      AND date <= $3::date
      AND (date >= $2::date OR diet_until >= $2::date)
    ORDER BY date ASC, id ASC
    `,
    [petId, startDate, endDate, TZ]
  )
  return result.rows
}

// ======================================================
// B. 比對「AI 建議避免的食物」
//
// AI 回傳的 avoidFoods 是自由文字（例如「牛奶」「高脂肪食物」「零食」），
// 所以除了直接比對名稱，也支援幾種常見的類型說法。
// food = { name, category, fatPer100g }
// ======================================================

const AVOID_ALIASES = [
  {
    test: /高脂|高油|油膩|油炸|脂肪/,
    exclude: /低脂|低油|少油/,
    match: food => num(food.fatPer100g, 0) >= CFG.highFatPer100g
  },
  {
    test: /零食|點心|小點/,
    match: food => food.category === 'snack'
  },
  {
    test: /乾糧|乾飼料|飼料/,
    match: food => food.category === 'dry'
  },
  {
    test: /罐頭|濕食|濕糧|主食罐/,
    match: food => food.category === 'wet'
  },
  {
    test: /乳製品|奶類|乳糖|牛奶|起司|優格/,
    match: food => /奶|乳|起司|優格|cheese|milk|yogurt/i.test(food.name || '')
  },
  {
    test: /生食|生肉|生的/,
    match: food => /生/.test(food.name || '')
  },
  {
    test: /骨頭|帶骨|骨/,
    match: food => /骨/.test(food.name || '')
  }
]

// 回傳第一個符合的 avoid 詞（沒有符合則 null）
function matchAvoidTerm(food, avoidFoods) {
  if (!food || !Array.isArray(avoidFoods)) return null

  const name = normName(food.name)

  for (const raw of avoidFoods) {
    const term = normName(raw)
    if (term.length < 2) continue

    // 1. 直接比對名稱
    if (name.length >= 2 && (name.includes(term) || term.includes(name))) {
      return String(raw)
    }

    // 2. 常見的類型說法
    for (const alias of AVOID_ALIASES) {
      if (alias.test.test(term) && !(alias.exclude && alias.exclude.test(term))) {
        if (alias.match(food)) return String(raw)
      }
    }
  }

  return null
}

// ======================================================
// C. 健康歷史警訊（選擇食物 / 新增餵食時）
//
// 回傳的格式與 food.js 現有的 warnings 相同：
//   { level, title, reason, suggestion }
// 額外欄位：
//   requireAck: false → 只是提醒，不需要使用者按「仍要儲存」，不阻擋操作
// ======================================================

function daysAgoText(n) {
  if (n === null || n === undefined) return '近期'
  if (n <= 0) return '今天'
  if (n === 1) return '昨天'
  return `${n} 天前`
}

function buildHealthHistoryWarnings({ food, events = [] }) {
  if (!events.length) return []

  const avoidWarnings = []
  const reminderWarnings = []
  const giWarnings = []

  const seenAvoid = new Set()
  let giWarned = false

  for (const e of events.slice(0, 5)) {
    const info = e.diet_info || {}
    const severityText = SEVERITY_LABEL[e.severity]
    const sourceText = e.source === 'ai_consult' ? 'AI 健康諮詢' : '健康紀錄'

    // ---- 1. AI 明確建議避免的食物與目前食物相符 ----
    const matched = matchAvoidTerm(food, info.avoidFoods)

    if (matched && !seenAvoid.has(matched)) {
      seenAvoid.add(matched)

      avoidWarnings.push({
        level: 'warning',
        source: 'health_history',
        check: 'health',
        kind: 'avoid_food',
        requireAck: false,
        title: `「${food.name}」可能屬於建議避免的食物`,
        reason:
          `${sourceText}針對${e.date_str}的「${e.title}」，` +
          `建議這段期間避免「${matched}」，目前選擇的食物可能相符。`,
        suggestion: '建議改選其他食物，或先詢問獸醫。'
      })
    }

    // ---- 2. 近期健康事件提醒（有紀錄才會出現）----
    const stillActive = Boolean(e.is_active)

    // 已明確過了飲食注意期（有 diet_until 且早於今天）→ 不再產生「近期曾有…紀錄」提醒，
    // 避免舊事件一直佔版面。事件仍保留在 health_records，供 AI 與週報參考。
    // 沒有設定注意期的事件（例如手動新增）維持原本「近 N 天」的提醒。
    const expired = !stillActive && Boolean(e.diet_until_str)

    if (!expired) reminderWarnings.push({
      level: stillActive ? 'warning' : 'info',
      source: 'health_history',
      check: 'health',
      kind: 'recent_event',
      requireAck: false,
      title: `此寵物近期曾有${e.title}紀錄`,
      reason:
        `${daysAgoText(e.days_ago)}有「${e.title}」紀錄` +
        `（${sourceText}${severityText ? `，${severityText}` : ''}）。` +
        (stillActive && e.diet_until_str
          ? `飲食注意期至 ${e.diet_until_str}。`
          : '') +
        '請注意目前選擇的食物。',
      suggestion:
        info.dietNotes ||
        (Array.isArray(info.dietAdvice) && info.dietAdvice[0]) ||
        '進食後請觀察狀況，若症狀持續或加重請諮詢獸醫。'
    })

    // ---- 3. 腸胃症狀期間，食物脂肪偏高 ----
    if (
      !giWarned &&
      stillActive &&
      GI_EVENT_TYPES.has(e.type) &&
      num(food.fatPer100g, 0) >= CFG.highFatPer100g
    ) {
      giWarned = true

      giWarnings.push({
        level: 'warning',
        source: 'health_history',
        check: 'health',
        kind: 'gi_high_fat',
        requireAck: false,
        title: `近期有${e.title}紀錄，此食物脂肪偏高`,
        reason:
          `目前選擇的「${food.name}」脂肪約 ` +
          `${round(num(food.fatPer100g, 0), 1)} g / 100g，` +
          '腸胃不適期間較油膩的食物可能造成負擔。',
        suggestion: '建議暫時選擇較清淡、低脂的食物，少量多餐並觀察狀況。'
      })
    }
  }

  return [
    ...avoidWarnings.slice(0, 3),
    ...giWarnings,
    ...reminderWarnings.slice(0, 3)
  ]
}

// ======================================================
// C2. 餵食前檢查流程的其他階段
//
// 每個警訊都有 check 欄位，標示它屬於哪個檢查階段：
//   health     → 健康歷史與飼主偏好
//   recentDiet → 近期飲食
//   nutrition  → 營養與食物安全
// 前端依此顯示「檢查流程」。
// ======================================================

// 從食物名稱判斷它標示給哪個物種（沒有標示則回傳 null）
function foodSpeciesTag(name) {
  const n = String(name || '')
  const cat = /貓|猫|cat|kitten/i.test(n)
  const dog = /犬|狗|dog|puppy/i.test(n)

  if (cat && !dog) return 'cat'
  if (dog && !cat) return 'dog'
  return null
}

// 階段：營養與食物安全（食物本身合不合適）
function buildNutritionChecks({ pet, food }) {
  const warnings = []
  const sKey = speciesKey(pet?.species)
  const tag = foodSpeciesTag(food?.name)

  // 貓吃犬用食物、狗吃貓用食物：營養需求不同
  if (sKey && tag && tag !== sKey) {
    const petText = sKey === 'cat' ? '貓' : '狗'
    const foodText = tag === 'cat' ? '貓用' : '犬用'

    warnings.push({
      level: 'warning',
      check: 'nutrition',
      kind: 'species_mismatch',
      requireAck: false,
      title: `「${food.name}」標示為${foodText}配方`,
      reason: `${petText}和${tag === 'cat' ? '狗' : '貓'}的營養需求不同，長期餵食可能不夠適合。`,
      suggestion: `建議選擇標示${petText}用的食物。`
    })
  }

  // 脂肪偏高的食物。
  // 乾糧／主食罐本身脂肪就偏高，所以門檻較高（25）；
  // 若一個「乾糧」脂肪超過 25%，通常是分類填錯（例如把漢堡分類成乾糧）。
  const fatThreshold = STAPLE_CATEGORIES.has(food?.category)
    ? CFG.stapleHighFatPer100g
    : CFG.highFatPer100g

  if (num(food?.fatPer100g, 0) >= fatThreshold) {
    warnings.push({
      level: 'warning',
      check: 'nutrition',
      kind: 'high_fat_food',
      requireAck: false,
      title: `「${food.name}」脂肪偏高`,
      reason: `脂肪約 ${round(num(food.fatPer100g, 0), 1)} g / 100g，屬於高脂肪食物。`,
      suggestion: '建議只偶爾少量給予，並避免和其他高脂食物一起餵。'
    })
  }

  return warnings
}

// 階段：近期飲食（同一種非主食最近是不是吃太多次）
// recentRecords: 最近 3 天的餵食紀錄 [{ foodName, day }]
function buildRecentDietWarnings({ food, recentRecords = [] }) {
  if (!food?.name || STAPLE_CATEGORIES.has(food.category)) return []

  const key = normName(food.name)
  const count = recentRecords.filter(r => normName(r.foodName) === key).length

  if (count < 3) return []

  return [
    {
      level: 'info',
      check: 'recentDiet',
      kind: 'repeat_food',
      requireAck: false,
      title: `近 3 天已餵過「${food.name}」${count} 次`,
      reason: '同一種非主食重複出現，營養可能不夠多樣。',
      suggestion: '建議搭配完整主食，並適度更換食物。'
    }
  ]
}

// 階段：健康歷史與飼主偏好（飼主自己設定要避免的食物／過敏）
// 這是飼主明確設定的，所以維持「需要確認」（不設 requireAck: false）
function buildOwnerPreferenceWarnings({ food, prefs }) {
  const term = matchAvoidTerm(
    { name: food?.name, category: food?.category, fatPer100g: food?.fatPer100g },
    prefs?.avoidFoods
  )

  if (!term) return []

  return [
    {
      level: 'danger',
      check: 'health',
      kind: 'owner_avoid',
      title: `「${food.name}」在你設定的避免清單中`,
      reason: `你在飲食偏好中設定要避免「${term}」。`,
      suggestion: '建議改選其他食物。'
    }
  ]
}

// ======================================================
// D. 餵食紀錄異常分析（純函式，方便測試）
//
// records: [{ id, foodName, category, amountG, calories,
//             proteinG, fatG, carbG, day }]
// day 為 'YYYY-MM-DD'（餵食當天，使用者本地時間）
// incompleteDay：尚未結束的日子（通常是今天），不納入「每日熱量」判斷
// ======================================================

function analyzeFeedingPattern({
  pet,
  records,
  startDate,
  endDate,
  incompleteDay = null
}) {
  const windowDays = dayDiff(startDate, endDate) + 1

  const valid = []
  const suspect = []

  for (const r of records) {
    const amount = num(r.amountG, 0)
    const kcal = num(r.calories)

    const implausible =
      !(amount > 0) ||
      amount > CFG.maxPlausibleAmountG ||
      (kcal !== null && kcal > CFG.maxPlausibleKcal)

    ;(implausible ? suspect : valid).push({
      ...r,
      amountG: amount,
      calories: kcal,
      proteinG: num(r.proteinG),
      fatG: num(r.fatG),
      carbG: num(r.carbG)
    })
  }

  const loggedDays = new Set(valid.map(r => r.day))

  const basis = {
    startDate,
    endDate,
    windowDays,
    records: valid.length,
    loggedDays: loggedDays.size,
    excluded: suspect.length,
    enough: false,
    weightBy: null,
    avgDailyKcal: null,
    macroShare: null,
    topFoods: [],
    skipped: []
  }

  const alerts = []

  // ---- 資料品質：份量／熱量明顯不合理的紀錄 ----
  if (suspect.length > 0) {
    const maxAmount = Math.max(...suspect.map(r => num(r.amountG, 0)))

    alerts.push({
      id: 'data_quality',
      level: 'info',
      title: '有幾筆餵食紀錄的份量看起來不太合理',
      message:
        `近 ${windowDays} 天有 ${suspect.length} 筆紀錄的份量或熱量異常偏大` +
        `（最大約 ${Math.round(maxAmount).toLocaleString('en-US')} g），` +
        '已先排除在分析之外。',
      suggestion: '建議確認輸入的份量與單位是否正確。'
    })
  }

  // ---- 資料量不足：不做任何模式判斷，避免單次餵食造成警訊 ----
  if (valid.length < CFG.minRecords || loggedDays.size < CFG.minDays) {
    return { alerts, basis }
  }

  basis.enough = true

  // ---- 加權基準：熱量資料夠完整就用熱量，否則用重量 ----
  const kcalCoverage =
    valid.filter(r => r.calories !== null).length / valid.length

  const weightBy = kcalCoverage >= 0.7 ? 'kcal' : 'grams'
  const metricLabel = weightBy === 'kcal' ? '熱量' : '攝取量'

  basis.weightBy = weightBy

  const valueOf = r =>
    weightBy === 'kcal' ? num(r.calories, 0) : num(r.amountG, 0)

  const total = valid.reduce((sum, r) => sum + valueOf(r), 0)

  // ---------- 1. 食物集中 ----------
  if (total > 0) {
    const groups = new Map()

    for (const r of valid) {
      const key = normName(r.foodName) || '(未命名)'

      if (!groups.has(key)) {
        groups.set(key, {
          name: r.foodName || '未命名食物',
          value: 0,
          days: new Set(),
          staple: false
        })
      }

      const g = groups.get(key)
      g.value += valueOf(r)
      g.days.add(r.day)
      if (STAPLE_CATEGORIES.has(r.category)) g.staple = true
    }

    const sorted = [...groups.values()].sort((a, b) => b.value - a.value)

    basis.topFoods = sorted.slice(0, 3).map(g => ({
      name: g.name,
      sharePct: pct(g.value / total)
    }))

    const top = sorted[0]
    const topShare = top.value / total

    // 每天吃同一款完整主食（乾糧／主食罐）是正常的，不視為異常。
    // 只有「單一食材或零食」占絕大部分時才提醒。
    const dominanceFired =
      topShare >= CFG.dominanceShare &&
      top.days.size >= CFG.dominanceMinDays &&
      !top.staple

    if (dominanceFired) {
      alerts.push({
        id: 'single_food_dominance',
        level: 'warning',
        title: '近期食物種類過於集中',
        message:
          `近 ${windowDays} 天「${top.name}」約佔 ${pct(topShare)}% 的${metricLabel}，` +
          `出現在 ${top.days.size} 天。`,
        suggestion:
          '單一食材難以提供完整營養，建議搭配適合的完整主食，並適度增加食物種類。'
      })
    }

    // 零食比例
    const snackValue = valid
      .filter(r => r.category === 'snack')
      .reduce((sum, r) => sum + valueOf(r), 0)

    const snackShare = snackValue / total

    if (snackShare >= CFG.snackShare) {
      alerts.push({
        id: 'high_snack_share',
        level: 'warning',
        title: '零食比例偏高',
        message:
          `零食約佔近 ${windowDays} 天${metricLabel}的 ${pct(snackShare)}%` +
          '（一般常見建議是控制在約 10% 以內）。',
        suggestion: '可以減少零食份量，並把零食一併算進每日總量。'
      })
    }

    // 主食比例偏低（已經因單一食物集中提醒過就不重複）
    const stapleValue = valid
      .filter(r => STAPLE_CATEGORIES.has(r.category))
      .reduce((sum, r) => sum + valueOf(r), 0)

    const stapleShare = stapleValue / total

    if (!dominanceFired && stapleShare < CFG.stapleMinShare) {
      alerts.push({
        id: 'low_staple_share',
        level: 'info',
        title: '主食比例偏低',
        message:
          `近 ${windowDays} 天主食（乾糧／主食罐）只佔約 ${pct(stapleShare)}% 的${metricLabel}，` +
          '多數是零食或單一食材。',
        suggestion: '營養可能不夠完整均衡，建議確認是否有固定的完整主食。'
      })
    }
  }

  // ---------- 2. 每日熱量偏高／偏低 ----------
  const sKey = speciesKey(pet?.species)
  const weightKg = num(pet?.weight)
  const [minKg, maxKg] = CFG.weightRangeKg

  const ageMonths = pet?.birth_date
    ? ageInMonths(pet.birth_date, endDate)
    : null

  const isYoung = ageMonths !== null && ageMonths < CFG.youngMonths
  const weightOk = weightKg !== null && weightKg >= minKg && weightKg <= maxKg

  if (!sKey) {
    basis.skipped.push('熱量：目前只支援貓、狗的熱量估算')
  } else if (isYoung) {
    basis.skipped.push('熱量：幼年寵物（未滿 12 個月）需求變動大，未做熱量判斷')
  } else if (!weightOk) {
    basis.skipped.push('熱量：寵物體重資料缺少或看起來不合理，無法估算')

    alerts.push({
      id: 'weight_check',
      level: 'info',
      title: '無法估算每日熱量需求',
      message:
        weightKg === null
          ? '寵物的體重資料尚未填寫。'
          : `寵物的體重資料（${weightKg} kg）看起來不太合理。`,
      suggestion: '更新體重後，系統才能判斷熱量是否偏高或偏低。'
    })
  } else {
    // 只看「已完成」的日子，今天還沒結束不列入
    const kcalByDay = new Map()

    for (const r of valid) {
      if (r.calories === null) continue
      if (incompleteDay && r.day >= incompleteDay) continue
      kcalByDay.set(r.day, (kcalByDay.get(r.day) || 0) + r.calories)
    }

    if (kcalByDay.size < CFG.minCalorieDays) {
      basis.skipped.push('熱量：已完成的紀錄日不足，未做熱量判斷')
    } else {
      const dailyValues = [...kcalByDay.values()]
      const avg = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length

      const rer = 70 * weightKg ** 0.75
      const reference = rer * CFG.merFactor[sKey]
      const ratio = avg / reference

      basis.avgDailyKcal = Math.round(avg)

      const detail =
        `近 ${windowDays} 天（已完成的 ${dailyValues.length} 天）平均每日約 ${Math.round(avg)} kcal，` +
        `以體重 ${weightKg} kg 粗估，約為一般需求（約 ${Math.round(reference)} kcal）的 ${round(ratio, 1)} 倍。`

      if (ratio >= CFG.calorieHighRatio) {
        alerts.push({
          id: 'calories_high',
          level: 'warning',
          title: '每日熱量可能偏高',
          message: detail,
          suggestion:
            '建議確認是否重複記錄，並留意體重變化；若長期偏多，可調整份量或詢問獸醫。'
        })
      } else if (ratio <= CFG.calorieLowRatio) {
        alerts.push({
          id: 'calories_low',
          level: 'info',
          title: '每日熱量可能偏低',
          message: detail,
          suggestion:
            '也可能是有餵食但沒有記錄；若確實吃得少且持續，建議觀察食慾並諮詢獸醫。'
        })
      }
    }
  }

  // ---------- 3. 營養比例（使用已存的 protein_g / fat_g / carb_g）----------
  const withMacro = valid.filter(r => r.proteinG !== null && r.fatG !== null)
  const macroDays = new Set(withMacro.map(r => r.day))

  if (withMacro.length >= CFG.minMacroRecords && macroDays.size >= CFG.minDays) {
    const P = withMacro.reduce((s, r) => s + r.proteinG * 4, 0)
    const F = withMacro.reduce((s, r) => s + r.fatG * 9, 0)
    const C = withMacro.reduce((s, r) => s + (r.carbG ?? 0) * 4, 0)
    const T = P + F + C

    if (T > 0) {
      const share = { protein: P / T, fat: F / T, carb: C / T }

      basis.macroShare = {
        protein: pct(share.protein),
        fat: pct(share.fat),
        carb: pct(share.carb)
      }

      const ratioText =
        `（蛋白質 ${pct(share.protein)}%、脂肪 ${pct(share.fat)}%、碳水 ${pct(share.carb)}%）`

      if (share.fat >= CFG.fatShareHigh) {
        alerts.push({
          id: 'fat_ratio_high',
          level: 'warning',
          title: '脂肪比例偏高',
          message: `近期營養熱量中，脂肪約佔 ${pct(share.fat)}%${ratioText}。`,
          suggestion: '建議留意脂肪來源，可搭配較低脂的食物。'
        })
      }

      const proteinLow =
        CFG.proteinShareLow[sKey] ?? CFG.proteinShareLow.default

      if (share.protein < proteinLow) {
        alerts.push({
          id: 'protein_ratio_low',
          level: 'info',
          title: '蛋白質比例偏低',
          message: `近期營養熱量中，蛋白質約佔 ${pct(share.protein)}%${ratioText}。`,
          suggestion: '建議確認食物是否含有足夠的優質蛋白質來源。'
        })
      }

      if (share.carb >= CFG.carbShareHigh) {
        alerts.push({
          id: 'carb_ratio_high',
          level: 'info',
          title: '碳水化合物比例偏高',
          message: `近期營養熱量中，碳水約佔 ${pct(share.carb)}%${ratioText}。`,
          suggestion: '可以留意澱粉類食物的份量，並搭配足夠的蛋白質。'
        })
      }
    }
  }

  // warning 排在 info 前面（同等級維持原順序）
  alerts.sort(
    (a, b) => (a.level === 'warning' ? 0 : 1) - (b.level === 'warning' ? 0 : 1)
  )

  return { alerts, basis }
}

// ======================================================
// E. 從資料庫取得餵食紀錄並分析
// 預設分析「最近 7 天（含今天）」；週報可指定 startDate / endDate
// ======================================================

async function getDietAlerts(petId, { startDate, endDate } = {}) {
  const petResult = await pool.query(
    'SELECT species, weight, birth_date FROM pets WHERE id = $1',
    [petId]
  )

  if (petResult.rows.length === 0) return null

  const clock = await pool.query(
    `
    SELECT
      to_char((NOW() AT TIME ZONE $1::text)::date, 'YYYY-MM-DD') AS today,
      to_char((NOW() AT TIME ZONE $1::text)::date - 6, 'YYYY-MM-DD') AS start
    `,
    [TZ]
  )

  const today = clock.rows[0].today

  const end = endDate ? String(endDate).slice(0, 10) : today
  const start = startDate ? String(startDate).slice(0, 10) : clock.rows[0].start

  const rows = await pool.query(
    `
    SELECT
      f.id,
      f.food_name,
      fi.category,
      f.amount_g::float AS amount_g,
      f.calories::float AS calories,
      f.protein_g::float AS protein_g,
      f.fat_g::float AS fat_g,
      f.carb_g::float AS carb_g,
      to_char(f.fed_at, 'YYYY-MM-DD') AS day
    FROM feeding_records f
    LEFT JOIN food_items fi ON fi.id = f.food_item_id
    WHERE f.pet_id = $1
      AND f.fed_at >= $2::date
      AND f.fed_at < ($3::date + 1)
    ORDER BY f.fed_at ASC
    `,
    [petId, start, end]
  )

  const pet = petResult.rows[0]

  return analyzeFeedingPattern({
    pet: {
      species: pet.species,
      weight: pet.weight,
      birth_date: pet.birth_date
        ? new Date(pet.birth_date).toISOString().slice(0, 10)
        : null
    },
    records: rows.rows.map(r => ({
      id: r.id,
      foodName: r.food_name,
      category: r.category,
      amountG: r.amount_g,
      calories: r.calories,
      proteinG: r.protein_g,
      fatG: r.fat_g,
      carbG: r.carb_g,
      day: r.day
    })),
    startDate: start,
    endDate: end,
    // 分析期間包含今天時，今天還沒結束，不納入每日熱量判斷
    incompleteDay: end >= today ? today : null
  })
}

// ======================================================
// F. 餵食紀錄 vs 健康事件建議避免的食物（週報用）
// 找出「事件發生之後、飲食注意期內」餵的、且與 avoidFoods 相符的紀錄
// ======================================================

async function findFeedingConflicts(petId, startDate, endDate, events) {
  const list = events || (await getDietEventsInRange(petId, startDate, endDate))

  const withAvoid = list.filter(
    e => Array.isArray(e.diet_info?.avoidFoods) && e.diet_info.avoidFoods.length
  )

  if (withAvoid.length === 0) return []

  const rows = await pool.query(
    `
    SELECT
      f.food_name,
      fi.category,
      f.amount_g::float AS amount_g,
      f.fat_g::float AS fat_g,
      to_char(f.fed_at, 'YYYY-MM-DD') AS day
    FROM feeding_records f
    LEFT JOIN food_items fi ON fi.id = f.food_item_id
    WHERE f.pet_id = $1
      AND f.fed_at >= $2::date
      AND f.fed_at < ($3::date + 1)
    ORDER BY f.fed_at ASC
    `,
    [petId, startDate, endDate]
  )

  const conflicts = []

  for (const r of rows.rows) {
    const amount = num(r.amount_g, 0)

    const food = {
      name: r.food_name,
      category: r.category,
      fatPer100g:
        amount > 0 && r.fat_g !== null ? (r.fat_g / amount) * 100 : null
    }

    for (const e of withAvoid) {
      // 只看事件發生當天（含）之後，到飲食注意期結束（含）
      const until = e.diet_until_str || e.date_str
      if (r.day < e.date_str || r.day > until) continue

      const term = matchAvoidTerm(food, e.diet_info.avoidFoods)

      if (term) {
        conflicts.push({
          foodName: r.food_name,
          fedDate: r.day,
          matchedAvoidTerm: term,
          eventTitle: e.title,
          eventDate: e.date_str
        })
        break
      }
    }

    if (conflicts.length >= 10) break
  }

  return conflicts
}

module.exports = {
  CFG,
  STAPLE_CATEGORIES,
  GI_EVENT_TYPES,
  num,
  round,
  dayDiff,
  speciesKey,
  foodSpeciesTag,
  buildNutritionChecks,
  buildRecentDietWarnings,
  buildOwnerPreferenceWarnings,
  ownsPet,
  getRecentDietEvents,
  getDietEventsInRange,
  matchAvoidTerm,
  buildHealthHistoryWarnings,
  analyzeFeedingPattern,
  getDietAlerts,
  findFeedingConflicts
}