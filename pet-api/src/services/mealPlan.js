// ======================================================
// 今日飲食計畫（Meal Plan）
//
// 依照以下資料，從「食物資料庫」挑選今天建議餵食的內容：
//   品種、貓／狗、年齡、體重、目前健康狀況、過往健康紀錄、飼主的養育偏好
//
// 設計原則：
//   1. 只從既有的 food_items 挑選，不會憑空生成食物。
//   2. 每個候選食物都先經過與「自己選擇」相同的檢查流程
//      （健康歷史 → 近期飲食 → 營養與安全），
//      危險、AI 建議避免、飼主設定避免的食物會直接排除。
//   3. 這是規則式的建議，不是醫療處方；資料不足時會明確說明，不會亂算。
//
// 這個檔案都是純函式（不碰資料庫），方便測試。
// ======================================================

const {
  CFG,
  STAPLE_CATEGORIES,
  GI_EVENT_TYPES,
  num,
  dayDiff,
  speciesKey,
  foodSpeciesTag
} = require('./dietInsights')

// ------------------------------------------------------
// 可調整的設定
// ------------------------------------------------------

// 餐次：share 是佔每日熱量的比例（每組加總為 1）
const MEAL_SLOTS = {
  2: [
    { key: 'breakfast', label: '早餐', time: '08:00', share: 0.5 },
    { key: 'dinner', label: '晚餐', time: '18:30', share: 0.5 }
  ],
  3: [
    { key: 'breakfast', label: '早餐', time: '08:00', share: 0.35 },
    { key: 'lunch', label: '午餐', time: '12:30', share: 0.3 },
    { key: 'dinner', label: '晚餐', time: '18:30', share: 0.35 }
  ],
  4: [
    { key: 'breakfast', label: '早餐', time: '08:00', share: 0.3 },
    { key: 'lunch', label: '午餐', time: '12:30', share: 0.25 },
    { key: 'dinner', label: '晚餐', time: '18:30', share: 0.25 },
    { key: 'late', label: '宵夜', time: '21:30', share: 0.2 }
  ]
}

// 用「幾點吃的」把今天已記錄的餵食歸到餐次（單位：一天中的第幾分鐘）
const MEAL_BOUNDARIES = {
  2: [{ key: 'breakfast', until: 840 }, { key: 'dinner', until: 1440 }],
  3: [
    { key: 'breakfast', until: 630 },
    { key: 'lunch', until: 930 },
    { key: 'dinner', until: 1440 }
  ],
  4: [
    { key: 'breakfast', until: 630 },
    { key: 'lunch', until: 930 },
    { key: 'dinner', until: 1230 },
    { key: 'late', until: 1440 }
  ]
}

const PLAN = {
  // 熱量係數（乘以 RER）。成年係數沿用 dietInsights 的 merFactor。
  youngFactor: { under4Months: { cat: 2.5, dog: 3.0 }, under12Months: 2.0 },
  seniorMultiplier: 0.9,
  seniorMonths: 84,
  goalMultiplier: { maintain: 1, lose: 0.8, gain: 1.2 },

  maxAmountG: 800, // 單餐份量上限（超過通常代表體重資料有問題）
  gentleMinMeals: 4, // 腸胃不適期間：少量多餐
  gentleLowFatPct: 10,
  optionsPerMeal: 3
}

// 常見品種的簡易對照（可自行增減）。
// size 只用來顯示，easyGain 只用來提醒留意份量；
// 沒有命中的品種不影響計畫。
const BREED_PROFILES = [
  { keys: ['拉布拉多', '拉不拉多', 'labrador'], size: '大型犬', easyGain: true },
  { keys: ['黃金獵犬', '黃金', 'golden'], size: '大型犬', easyGain: true },
  { keys: ['德國牧羊', '德牧', 'german shepherd'], size: '大型犬' },
  { keys: ['哈士奇', 'husky'], size: '中大型犬' },
  { keys: ['米格魯', '比格', 'beagle'], size: '中型犬', easyGain: true },
  { keys: ['鬥牛', 'bulldog'], size: '中型犬', easyGain: true },
  { keys: ['柴犬', 'shiba'], size: '中型犬' },
  { keys: ['柯基', 'corgi'], size: '小中型犬', easyGain: true },
  { keys: ['巴哥', '哈巴', 'pug'], size: '小型犬', easyGain: true },
  { keys: ['貴賓', '泰迪', 'poodle'], size: '小型犬' },
  { keys: ['吉娃娃', 'chihuahua'], size: '小型犬' },
  { keys: ['馬爾濟斯', '瑪爾濟斯', 'maltese'], size: '小型犬' },
  { keys: ['約克夏', 'yorkshire'], size: '小型犬' },
  { keys: ['博美', 'pomeranian'], size: '小型犬' },
  { keys: ['英短', '英國短毛', 'british shorthair'], size: '中型貓', easyGain: true },
  { keys: ['布偶', 'ragdoll'], size: '大型貓' },
  { keys: ['緬因', 'maine coon'], size: '大型貓' }
]

function breedProfile(breed) {
  const text = String(breed || '').toLowerCase().replace(/\s+/g, '')
  if (!text) return null

  return (
    BREED_PROFILES.find(p =>
      p.keys.some(k => text.includes(k.toLowerCase().replace(/\s+/g, '')))
    ) || null
  )
}

// ======================================================
// 飼主偏好（存在 pets.diet_preferences）
// ======================================================

const STAPLE_TYPES = ['any', 'dry', 'wet', 'mixed']
const GOALS = ['maintain', 'lose', 'gain']

function cleanText(value, maxLen) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLen)
}

function sanitizePreferences(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}

  const meals = Math.round(Number(src.mealsPerDay))

  const avoid = []
  if (Array.isArray(src.avoidFoods)) {
    for (const item of src.avoidFoods) {
      const text = cleanText(item, 30)
      if (text && !avoid.includes(text)) avoid.push(text)
      if (avoid.length >= 10) break
    }
  }

  return {
    mealsPerDay: meals >= 2 && meals <= 4 ? meals : 3,
    stapleType: STAPLE_TYPES.includes(src.stapleType) ? src.stapleType : 'any',
    goal: GOALS.includes(src.goal) ? src.goal : 'maintain',
    avoidFoods: avoid,
    notes: cleanText(src.notes, 200)
  }
}

// ======================================================
// 年齡、熱量
// ======================================================

function stageOf(ageMonths) {
  if (ageMonths === null || ageMonths === undefined) return 'adult'
  if (ageMonths < 12) return 'young'
  if (ageMonths >= PLAN.seniorMonths) return 'senior'
  return 'adult'
}

function ageText(ageMonths) {
  if (ageMonths === null || ageMonths === undefined) return null
  if (ageMonths < 12) return `${Math.max(ageMonths, 0)} 個月`
  const years = Math.floor(ageMonths / 12)
  const rest = ageMonths % 12
  return rest ? `${years} 歲 ${rest} 個月` : `${years} 歲`
}

// 每日建議熱量（粗估，不是處方）
// 回傳 null 代表資料不足或不合理，此時不會給份量
function estimateTargetKcal({ species, weightKg, ageMonths, goal, weightControl }) {
  const sKey = speciesKey(species)
  const [minKg, maxKg] = CFG.weightRangeKg

  if (!sKey) return { kcal: null, reason: 'species' }
  if (weightKg === null || weightKg < minKg || weightKg > maxKg) {
    return { kcal: null, reason: weightKg === null ? 'weight_missing' : 'weight_invalid' }
  }

  const stage = stageOf(ageMonths)
  const rer = 70 * weightKg ** 0.75

  let factor
  if (stage === 'young') {
    factor =
      ageMonths < 4
        ? PLAN.youngFactor.under4Months[sKey]
        : PLAN.youngFactor.under12Months
  } else {
    factor = CFG.merFactor[sKey]
    if (stage === 'senior') factor *= PLAN.seniorMultiplier
  }

  // 已被判斷需要控制體重、但飼主沒有另外設定目標時，視同減重
  const effectiveGoal = goal === 'maintain' && weightControl ? 'lose' : goal

  // 幼年寵物不做減重／增重調整（成長需求特殊）
  const multiplier =
    stage === 'young' ? 1 : PLAN.goalMultiplier[effectiveGoal] ?? 1

  return {
    kcal: Math.round(rer * factor * multiplier),
    rer: Math.round(rer),
    factor: Math.round(factor * 100) / 100,
    goal: effectiveGoal,
    stage
  }
}

// ======================================================
// 候選食物
// ======================================================

// 食物名稱中的年齡標示
function foodAgeTag(name) {
  const n = String(name || '')
  if (/幼|kitten|puppy|junior/i.test(n)) return 'young'
  if (/高齡|熟齡|老年|senior|7\+|8\+|11\+/i.test(n)) return 'senior'
  if (/成|adult/i.test(n)) return 'adult'
  return null
}

// 能不能當「主食」候選：
// - 必須是乾糧／主食罐，且有熱量資料
// - 名稱標示的物種必須和寵物相符
// - 沒有標示物種的食物，只有「預設食物」才視為可靠
//   （使用者自己新增的食物，分類欄位常常不準確，例如把漢堡分類成乾糧）
function isCandidateStaple(food, sKey) {
  if (!STAPLE_CATEGORIES.has(food.category)) return false
  if (!(num(food.calories_per_100g, 0) > 0)) return false

  const tag = foodSpeciesTag(food.name)
  if (tag && sKey && tag !== sKey) return false
  if (!tag && !food.is_preset) return false

  return true
}

function roundAmount(grams) {
  const rounded = grams >= 25 ? Math.round(grams / 5) * 5 : Math.round(grams)
  return Math.max(rounded, 5)
}

// 該餐想要的主食類型（乾濕搭配：晚餐吃濕食）
function wantedCategory(stapleType, slotKey) {
  if (stapleType === 'dry') return 'dry'
  if (stapleType === 'wet') return 'wet'
  if (stapleType === 'mixed') return slotKey === 'dinner' ? 'wet' : 'dry'
  return null
}

function bucketOf(mealCount, minutes) {
  const list = MEAL_BOUNDARIES[mealCount]
  return (list.find(b => minutes < b.until) || list[list.length - 1]).key
}

// ======================================================
// 主函式
//
// warningsByFoodId：route 先用「自己選擇」同一套檢查流程算好的警訊
// todayRecords：[{ foodName, calories, minutes }] 今天已記錄的餵食
// ======================================================

function buildMealPlan({
  pet,
  prefs,
  events = [],
  foods = [],
  warningsByFoodId = {},
  todayRecords = [],
  weightControl = false,
  refDate
}) {
  const sKey = speciesKey(pet?.species)
  const weightKg = num(pet?.weight)

  const ageMonths = pet?.birth_date
    ? Math.max(Math.floor(dayDiff(String(pet.birth_date).slice(0, 10), refDate) / 30.4), 0)
    : null

  const stage = stageOf(ageMonths)
  const profile = breedProfile(pet?.breed)

  const activeEvents = events.filter(e => e.is_active)
  const gentle = activeEvents.some(e => GI_EVENT_TYPES.has(e.type))
  const seriousEvent = activeEvents.some(
    e => e.severity === 'urgent' || e.severity === 'emergency'
  )

  const mealCount = gentle
    ? Math.max(prefs.mealsPerDay, PLAN.gentleMinMeals)
    : prefs.mealsPerDay

  const target = estimateTargetKcal({
    species: pet?.species,
    weightKg,
    ageMonths,
    goal: prefs.goal,
    weightControl
  })

  const notices = []

  // ---------- 說明與提醒 ----------
  if (!sKey) {
    notices.push({ level: 'warning', text: '目前只支援貓、狗的飲食計畫。' })
  }

  if (sKey && target.kcal === null) {
    notices.push({
      level: 'warning',
      text:
        target.reason === 'weight_missing'
          ? '尚未填寫體重，無法計算建議份量。請先到寵物資料補上體重。'
          : `體重資料（${weightKg} kg）看起來不太合理，無法計算建議份量。請確認寵物體重。`
    })
  }

  if (ageMonths === null && sKey) {
    notices.push({ level: 'info', text: '尚未填寫生日，先以成年寵物估算。' })
  }

  if (stage === 'young') {
    notices.push({
      level: 'info',
      text: '幼年寵物的成長需求特殊，建議使用幼年專用配方，並諮詢獸醫。'
    })
  }

  if (stage === 'senior') {
    notices.push({ level: 'info', text: '高齡寵物的熱量需求通常較低，已略為下調。' })
  }

  if (profile?.easyGain) {
    notices.push({
      level: 'info',
      text: `${pet.breed}一般認為比較容易發胖，建議定期量體重並留意份量。`
    })
  }

  if (target.goal === 'lose' && stage !== 'young' && target.kcal !== null) {
    notices.push({
      level: 'info',
      text:
        prefs.goal === 'lose'
          ? '已依你設定的「減重」目標降低約 20% 熱量。'
          : '健康紀錄中提到體重偏重，已降低約 20% 熱量。'
    })
  }

  if (target.goal === 'gain' && stage !== 'young' && target.kcal !== null) {
    notices.push({ level: 'info', text: '已依你設定的「增重」目標提高約 20% 熱量。' })
  }

  for (const e of activeEvents.slice(0, 3)) {
    const info = e.diet_info || {}
    const until = e.diet_until_str ? `（注意期至 ${e.diet_until_str}）` : ''

    notices.push({
      level: 'warning',
      text:
        `近期有「${e.title}」紀錄${until}。` +
        (info.dietNotes ? `${info.dietNotes}。` : '')
    })
  }

  if (gentle) {
    notices.push({
      level: 'info',
      text: `腸胃不適期間改為少量多餐（${mealCount} 餐），並優先選擇低脂、較清淡的食物。`
    })
  }

  if (seriousEvent) {
    notices.push({
      level: 'warning',
      text: '近期健康事件屬於「建議儘快就醫」等級，這份計畫僅供參考，請先諮詢獸醫。'
    })
  }

  // ---------- 篩選並評分候選食物 ----------
  const excluded = []
  const scored = []

  for (const food of foods) {
    if (!sKey || !isCandidateStaple(food, sKey)) continue

    const ageTag = foodAgeTag(food.name)
    if (ageTag === 'young' && stage !== 'young') continue

    const warnings = warningsByFoodId[food.id] || []

    // 危險、AI 建議避免、飼主設定避免 → 直接排除
    const blocker = warnings.find(
      w => w.level === 'danger' || w.kind === 'avoid_food' || w.kind === 'owner_avoid'
    )

    if (blocker) {
      excluded.push({ name: food.name, reason: blocker.title })
      continue
    }

    let score = 0
    const reasons = []
    const fat = num(food.fat_pct, 0)
    const kcal100 = num(food.calories_per_100g, 0)

    const tag = foodSpeciesTag(food.name)
    if (tag === sKey) {
      score += 3
      reasons.push(sKey === 'cat' ? '貓用主食' : '犬用主食')
    } else if (food.is_preset) {
      reasons.push('預設主食')
    }
    if (food.is_preset) score += 1

    if (stage === 'young' && ageTag === 'young') {
      score += 3
      reasons.push('幼年配方')
    } else if (stage === 'senior' && ageTag === 'senior') {
      score += 2
      reasons.push('高齡配方')
    } else if (stage === 'adult' && ageTag === 'adult') {
      score += 1
      reasons.push('成年配方')
    }

    if (gentle) {
      if (fat < PLAN.gentleLowFatPct) {
        score += 3
        reasons.push('低脂，適合腸胃恢復期')
      } else {
        score -= 2
      }
      if (food.category === 'wet') score += 2
    }

    if (target.goal === 'lose') {
      if (kcal100 < 100) {
        score += 2
        reasons.push('熱量密度較低，適合控制體重')
      }
      if (fat >= CFG.highFatPer100g) score -= 2
    }

    // 「警告」等級的警訊：仍可推薦，但降低排序並在畫面上提醒
    const shown = warnings.filter(w => w.level !== 'info')
    score -= Math.min(shown.length * 2, 4)

    scored.push({ food, score, reasons, warnings: shown })
  }

  scored.sort((a, b) => b.score - a.score || a.food.id - b.food.id)

  // ---------- 排餐 ----------
  const slots = MEAL_SLOTS[mealCount]

  const loggedByMeal = {}
  for (const r of todayRecords) {
    const key = bucketOf(mealCount, r.minutes ?? 0)
    loggedByMeal[key] = loggedByMeal[key] || { count: 0, kcal: 0 }
    loggedByMeal[key].count += 1
    loggedByMeal[key].kcal += num(r.calories, 0)
  }

  const meals = slots.map(slot => {
    const wanted = wantedCategory(prefs.stapleType, slot.key)

    // 想要的類型排前面，其餘補在後面
    const ordered = wanted
      ? [
          ...scored.filter(s => s.food.category === wanted),
          ...scored.filter(s => s.food.category !== wanted)
        ]
      : scored

    const mealKcal = target.kcal === null ? null : target.kcal * slot.share

    const options = ordered.slice(0, PLAN.optionsPerMeal).map(s => {
      const kcal100 = num(s.food.calories_per_100g, 0)

      let amountG = null
      let kcal = null
      let capped = false

      if (mealKcal !== null) {
        let grams = (mealKcal / kcal100) * 100
        if (grams > PLAN.maxAmountG) {
          grams = PLAN.maxAmountG
          capped = true
        }
        amountG = roundAmount(grams)
        kcal = Math.round((amountG * kcal100) / 100)
      }

      const reasons = [...s.reasons]
      if (wanted && s.food.category === wanted) {
        reasons.push(wanted === 'dry' ? '符合你偏好的乾糧' : '符合你偏好的濕食')
      }

      return {
        foodId: s.food.id,
        name: s.food.name,
        category: s.food.category,
        amountG,
        kcal,
        capped,
        proteinPct: num(s.food.protein_pct),
        fatPct: num(s.food.fat_pct),
        reasons,
        warnings: s.warnings.map(w => ({
          level: w.level,
          title: w.title,
          reason: w.reason
        }))
      }
    })

    const logged = loggedByMeal[slot.key]

    return {
      key: slot.key,
      label: slot.label,
      time: slot.time,
      targetKcal: mealKcal === null ? null : Math.round(mealKcal),
      options,
      logged: Boolean(logged),
      loggedKcal: logged ? Math.round(logged.kcal) : 0
    }
  })

  if (sKey && scored.length === 0) {
    notices.push({
      level: 'warning',
      text:
        '食物資料庫中沒有適合這隻寵物的主食（乾糧／主食罐）。請先新增食物，或改用「自己選擇」。'
    })
  }

  const loggedKcal = Math.round(
    todayRecords.reduce((sum, r) => sum + num(r.calories, 0), 0)
  )

  return {
    pet: {
      name: pet?.name,
      species: sKey,
      breed: pet?.breed || null,
      size: profile?.size || null,
      ageText: ageText(ageMonths),
      stage,
      weightKg
    },
    mode: gentle ? 'gentle' : 'normal',
    preferences: prefs,
    target: {
      kcal: target.kcal,
      goal: target.goal || prefs.goal
    },
    today: { loggedKcal, targetKcal: target.kcal },
    notices,
    meals,
    excluded: excluded.slice(0, 6)
  }
}

module.exports = {
  MEAL_SLOTS,
  sanitizePreferences,
  breedProfile,
  estimateTargetKcal,
  isCandidateStaple,
  foodAgeTag,
  buildMealPlan
}