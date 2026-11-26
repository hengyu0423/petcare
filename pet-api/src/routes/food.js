const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')
const { ageInMonths, formatAge } = require('../utils/petAge')
const {
  ownsPet,
  getRecentDietEvents,
  buildHealthHistoryWarnings,
  buildNutritionChecks,
  buildRecentDietWarnings,
  buildOwnerPreferenceWarnings
} = require('../services/dietInsights')
const {
  sanitizePreferences,
  isCandidateStaple,
  buildMealPlan,
  estimateTargetKcal
} = require('../services/mealPlan')
const {
  getTargetsForDates,
  rangeStatus
} = require('../services/nutritionTargets')
const {
  retrieveKnowledge,
  formatKnowledgeForPrompt
} = require('../services/knowledge')
const { matchUnsafeFoodRules } = require('../services/foodSafety')
const { generateGeminiText } = require('../services/geminiText')

const DIET_TZ = process.env.APP_TIMEZONE || 'Asia/Taipei'
const Groq = require('groq-sdk')
const multer = require('multer')

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

const upload = multer({
  storage: multer.memoryStorage()
})

router.use(requireAuth)

const DEFAULT_GROQ_MODEL =
  process.env.GROQ_MODEL ||
  'openai/gpt-oss-120b'


/* =========================================================
   工具函式
========================================================= */

function normalizeText(text) {
  return String(text || '')
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<\s*\/\s*think\b[^>]*>/gi, '')
    .replace(/<\|[^|]*\|>/g, '')
    .replace(/grounded[\s\S]*?<\/think>/g, '')
    .replace(/grounded[\s\S]*/g, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}


function toSafeNumber(value, fallback = 0) {
  const number = Number(value)

  return Number.isFinite(number)
    ? number
    : fallback
}


function extractJsonObject(text) {
  const cleaned = normalizeText(text)

  const match =
    cleaned.match(/\{[\s\S]*\}/)

  if (!match) return null

  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}


function buildDefaultNutrition(
  foodName = '未知食物'
) {
  return {
    food_name: foodName,
    brand: '',
    category: 'other',

    calories_per_100g: 0,

    protein_pct: 0,
    fat_pct: 0,
    carb_pct: 0,
    fiber_pct: 0,

    estimated_weight_g: 100
  }
}


function normalizeSpecies(species = '') {
  return String(species || '')
    .toLowerCase()
    .trim()
}


/* =========================================================
   本地營養 fallback

   Groq 無法取得資料時使用。
========================================================= */

function getFallbackNutrition(
  foodName = '未知食物'
) {
  const name =
    String(foodName || '')
      .toLowerCase()
      .trim()


  if (
    name.includes('雞胸') ||
    name.includes('雞肉') ||
    name.includes('chicken')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 165,
      protein_pct: 31,
      fat_pct: 3.6,
      carb_pct: 0,
      fiber_pct: 0
    }
  }


  if (
    name.includes('鮭魚') ||
    name.includes('三文魚') ||
    name.includes('salmon')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 208,
      protein_pct: 20,
      fat_pct: 12,
      carb_pct: 0,
      fiber_pct: 0
    }
  }


  if (
    name.includes('牛肉') ||
    name.includes('beef')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 250,
      protein_pct: 26,
      fat_pct: 15,
      carb_pct: 0,
      fiber_pct: 0
    }
  }


  if (
    name.includes('豬肉') ||
    name.includes('pork')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 242,
      protein_pct: 27,
      fat_pct: 14,
      carb_pct: 0,
      fiber_pct: 0
    }
  }


  if (
    name.includes('雞蛋') ||
    name === '蛋' ||
    name.includes('egg')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 143,
      protein_pct: 12.6,
      fat_pct: 9.5,
      carb_pct: 0.7,
      fiber_pct: 0
    }
  }


  if (
    name.includes('白飯') ||
    name.includes('米飯') ||
    name.includes('rice')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 130,
      protein_pct: 2.7,
      fat_pct: 0.3,
      carb_pct: 28,
      fiber_pct: 0.4
    }
  }


  if (
    name.includes('地瓜') ||
    name.includes('番薯') ||
    name.includes('sweet potato')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 86,
      protein_pct: 1.6,
      fat_pct: 0.1,
      carb_pct: 20.1,
      fiber_pct: 3
    }
  }


  if (
    name.includes('南瓜') ||
    name.includes('pumpkin')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 26,
      protein_pct: 1,
      fat_pct: 0.1,
      carb_pct: 6.5,
      fiber_pct: 0.5
    }
  }


  if (
    name.includes('紅蘿蔔') ||
    name.includes('胡蘿蔔') ||
    name.includes('carrot')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 41,
      protein_pct: 0.9,
      fat_pct: 0.2,
      carb_pct: 9.6,
      fiber_pct: 2.8
    }
  }


  if (
    name.includes('花椰菜') ||
    name.includes('花菜') ||
    name.includes('broccoli') ||
    name.includes('cauliflower')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 30,
      protein_pct: 2,
      fat_pct: 0.3,
      carb_pct: 5,
      fiber_pct: 2.5
    }
  }


  if (
    name.includes('罐頭') ||
    name.includes('濕食') ||
    name.includes('wet')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 90,
      protein_pct: 10,
      fat_pct: 4,
      carb_pct: 3,
      fiber_pct: 1
    }
  }


  if (
    name.includes('乾糧') ||
    name.includes('飼料') ||
    name.includes('dry')
  ) {
    return {
      ...buildDefaultNutrition(foodName),

      calories_per_100g: 360,
      protein_pct: 25,
      fat_pct: 12,
      carb_pct: 40,
      fiber_pct: 3
    }
  }


  return buildDefaultNutrition(foodName)
}


/* =========================================================
   AI 營養分析
========================================================= */

async function analyzeNutrition(foodName) {
  if (!foodName) {
    return buildDefaultNutrition()
  }


  if (!process.env.GROQ_API_KEY) {
    return getFallbackNutrition(foodName)
  }


  try {
    const completion =
      await groq.chat.completions.create({
        model: DEFAULT_GROQ_MODEL,

        messages: [
          {
            role: 'system',

            content: `
你是一個食物營養資料分析模型。

請根據使用者輸入的食物名稱，
估算每 100 克食物的營養資料。

規則：

1. 只能輸出 JSON。
2. 不要輸出 Markdown。
3. 不要輸出思考過程。
4. 使用合理的常見營養資料估算。
5. 不知道品牌時仍然需要使用一般食品平均值估算。
6. 只有真的完全無法辨認食物時才可以全部填 0。

注意：

protein_pct
fat_pct
carb_pct
fiber_pct

表示每 100 克食物中含有多少克，
例如 fat_pct = 5
代表每 100 克含 5 克脂肪。

JSON 格式：

{
  "food_name": "",
  "brand": "",
  "category": "other",
  "calories_per_100g": 0,
  "protein_pct": 0,
  "fat_pct": 0,
  "carb_pct": 0,
  "fiber_pct": 0,
  "estimated_weight_g": 100
}
`
          },

          {
            role: 'user',
            content: String(foodName).trim()
          }
        ],

        temperature: 0.1,

        max_completion_tokens: 400
      })


    const raw =
      completion.choices?.[0]?.message?.content ||
      ''


    console.log(
      'Nutrition AI raw:',
      raw
    )


    const parsed =
      extractJsonObject(raw)


    if (parsed) {
      const result = {
        ...buildDefaultNutrition(foodName),
        ...parsed,

        food_name:
          parsed.food_name ||
          foodName,

        calories_per_100g:
          toSafeNumber(
            parsed.calories_per_100g
          ),

        protein_pct:
          toSafeNumber(
            parsed.protein_pct
          ),

        fat_pct:
          toSafeNumber(
            parsed.fat_pct
          ),

        carb_pct:
          toSafeNumber(
            parsed.carb_pct
          ),

        fiber_pct:
          toSafeNumber(
            parsed.fiber_pct
          ),

        estimated_weight_g:
          toSafeNumber(
            parsed.estimated_weight_g,
            100
          )
      }


      if (
        result.calories_per_100g > 0
      ) {
        return result
      }
    }


    return getFallbackNutrition(
      foodName
    )

  } catch (err) {
    console.error(
      'analyzeNutrition error:',
      err
    )

    return getFallbackNutrition(
      foodName
    )
  }
}


/* =========================================================
   Gemini 食物圖片辨識
========================================================= */

async function detectFood(req) {
  if (!req.file?.buffer) {
    return '未知食物'
  }


  if (!process.env.GEMINI_API_KEY) {
    return '未知食物'
  }


  try {
    const base64Image =
      req.file.buffer.toString(
        'base64'
      )


    const { text } =
      await generateGeminiText({
        contents: [
          {
            inlineData: {
              mimeType:
                req.file.mimetype,

              data:
                base64Image
            }
          },

          {
            text: `
請辨識圖片中的主要食物。

只回答食物名稱，但名稱裡要包含看得得到的主要食材，
這樣系統才能判斷有沒有對貓狗危險的成分（蔥、蒜、洋蔥、葡萄、巧克力、酒等）。

不要解釋。
不要輸出 JSON。
不要輸出其他文字。

例如：

雞胸肉
鮭魚
洋蔥牛肉湯
蒜炒青菜
葡萄乾麵包
帶骨炸雞
狗乾糧
貓罐頭
南瓜

如果真的無法判斷：

未知食物
`
          }
        ]
      })


    const foodName =
      normalizeText(
        text || ''
      )
        .replace(
          /^食物(?:名稱)?[:：\s]*/i,
          ''
        )
        .replace(
          /^辨識結果[:：\s]*/i,
          ''
        )
        .replace(
          /^答案[:：\s]*/i,
          ''
        )
        .replace(
          /^[`"'「」]+|[`"'「」]+$/g,
          ''
        )
        .trim()


    if (
      foodName &&
      foodName !== '未知食物' &&
      foodName !== 'unknown' &&
      foodName !== 'unknown food'
    ) {
      return foodName
    }


    return '未知食物'

  } catch (err) {
    console.error(
      'Gemini Vision error（含備援模型都失敗）:',
      err?.status || err
    )

    /*
     * null = 服務失敗（不是看不出這是什麼食物），
     * 讓路由回明確錯誤，前端才能顯示「服務暫時忙，請重試」。
     */
    return null
  }
}


/* =========================================================
   預設食物
========================================================= */

const PRESET_FOODS = [
  {
    name: '希爾思成貓配方乾糧',
    category: 'dry',
    brand: "Hill's",

    calories_per_100g: 380,
    protein_pct: 32,
    fat_pct: 14,
    carb_pct: 40,
    fiber_pct: 4
  },

  {
    name: '皇家成貓主食罐',
    category: 'wet',
    brand: 'Royal Canin',

    calories_per_100g: 92,
    protein_pct: 12,
    fat_pct: 5,
    carb_pct: 3,
    fiber_pct: 1
  },

  {
    name: '希爾思成犬配方乾糧',
    category: 'dry',
    brand: "Hill's",

    calories_per_100g: 363,
    protein_pct: 20,
    fat_pct: 12,
    carb_pct: 55,
    fiber_pct: 3
  },

  {
    name: '皇家成犬主食罐',
    category: 'wet',
    brand: 'Royal Canin',

    calories_per_100g: 85,
    protein_pct: 10,
    fat_pct: 4,
    carb_pct: 3,
    fiber_pct: 1
  },

  {
    name: '凍乾雞肉條',
    category: 'snack',
    brand: '自然良品',

    calories_per_100g: 450,
    protein_pct: 65,
    fat_pct: 8,
    carb_pct: 5,
    fiber_pct: 0
  },

  {
    name: '鮭魚貓糧',
    category: 'wet',
    brand: 'Fancy Feast',

    calories_per_100g: 78,
    protein_pct: 11,
    fat_pct: 4,
    carb_pct: 2,
    fiber_pct: 0
  }
]


/* =========================================================
   飲食分析規則

   注意：
   這是專題 Demo 用規則。
   之後可以搬到 food_rules 資料表。
========================================================= */

const DIET_RULES = {
  // 每 100g 超過這個熱量，才視為高熱量食物（用於肥胖／過重寵物的提醒）
  highCalories: 350
}


/* =========================================================
   危險食物規則已搬到 services/foodSafety.js
   （貓／狗不能吃的完整清單在那裡：圖片辨識與手動輸入都走同一套規則）
   呼叫 matchUnsafeFoodRules({ species, names }) 取得警訊。
========================================================= */


/* =========================================================
   整理單筆歷史飲食
========================================================= */

async function normalizeMeal(meal) {
  const foodObject =
    meal.food ||
    meal.food_item ||
    meal.foodItem ||
    {}


  const foodName =
    meal.food_name ||
    meal.foodName ||
    meal.name ||
    foodObject.name ||
    foodObject.food_name ||
    '未知食物'


  const amount =
    toSafeNumber(
      meal.amount_g ??
      meal.amount ??
      meal.grams ??
      meal.quantity ??
      meal.estimated_weight_g,
      100
    )


  /*
   * 優先使用資料庫已有營養資料
   */

  const calories =
    meal.calories_per_100g ??
    foodObject.calories_per_100g


  if (
    calories !== undefined &&
    calories !== null
  ) {
    return {
      food_name: foodName,

      amount_g: amount,

      calories_per_100g:
        toSafeNumber(calories),

      protein_pct:
        toSafeNumber(
          meal.protein_pct ??
          foodObject.protein_pct
        ),

      fat_pct:
        toSafeNumber(
          meal.fat_pct ??
          foodObject.fat_pct
        ),

      carb_pct:
        toSafeNumber(
          meal.carb_pct ??
          foodObject.carb_pct
        ),

      fiber_pct:
        toSafeNumber(
          meal.fiber_pct ??
          foodObject.fiber_pct
        ),

      fed_at:
        meal.fed_at ||
        meal.created_at ||
        null
    }
  }


  /*
   * 沒資料才使用 AI
   */

  const nutrition =
    await analyzeNutrition(
      foodName
    )


  return {
    ...nutrition,

    amount_g: amount,

    fed_at:
      meal.fed_at ||
      meal.created_at ||
      null
  }
}


/* =========================================================
   歷史飲食分析（一般只關注熱量）
   商業飼料已包含均衡營養，不再用脂肪／蛋白質判斷。
========================================================= */

function analyzeDietHistory(
  meals = []
) {
  if (!meals.length) {
    return {
      hasData: false,
      mealCount: 0,
      totalWeight: 0,
      totalCalories: 0,
      avgCaloriesPer100g: 0,
      daysWithRecords: 0,
      avgDailyCalories: 0
    }
  }

  let totalWeight = 0
  let totalCalories = 0

  for (const meal of meals) {
    const amount =
      Math.max(
        toSafeNumber(
          meal.amount_g,
          100
        ),
        1
      )

    const factor = amount / 100

    totalWeight += amount

    totalCalories +=
      toSafeNumber(
        meal.calories_per_100g
      ) * factor
  }

  const avgCaloriesPer100g =
    totalWeight > 0
      ? (totalCalories / totalWeight) * 100
      : 0

  // 每天合計熱量：用來判斷「近期吃太多／太少」，而不是用單食物密度判斷
  const caloriesByDay = new Map()

  for (const meal of meals) {
    const day = String(meal.fed_at || '').slice(0, 10)
    if (!day) continue

    const mealCalories =
      toSafeNumber(
        meal.calories_per_100g
      ) * (Math.max(toSafeNumber(meal.amount_g, 100), 1) / 100)

    caloriesByDay.set(
      day,
      (caloriesByDay.get(day) || 0) + mealCalories
    )
  }

  const daysWithRecords = caloriesByDay.size
  const calorieValues = [...caloriesByDay.values()]
  const avgDailyCalories = daysWithRecords
    ? Math.round(
        calorieValues.reduce((sum, value) => sum + value, 0) /
          daysWithRecords
      )
    : 0

  return {
    hasData: true,

    mealCount:
      meals.length,

    totalWeight:
      Number(
        totalWeight.toFixed(1)
      ),

    totalCalories:
      Number(
        totalCalories.toFixed(1)
      ),

    avgCaloriesPer100g:
      Number(
        avgCaloriesPer100g.toFixed(1)
      ),

    daysWithRecords,

    avgDailyCalories
  }
}


/* =========================================================
   根據歷史熱量產生推薦
========================================================= */

function buildRecommendation(
  pet,
  history,
  healthSummary = ''
) {
  if (!history.hasData) {
    return {
      type: 'no_data',

      title:
        '需要更多飲食紀錄',

      recommendation:
        '請先記錄幾次餵食，系統就能根據每天的熱量攝取提供推薦。',

      reason:
        '目前沒有足夠的近期飲食資料。'
    }
  }

  /*
   * 以「有紀錄日子的每日平均熱量」和
   * 依體重估算的每日需求（DER）比較。
   * 固定飼料為主，建議核心是「餵多少」，不是換食物。
   */
  const weightKg =
    Number(pet?.weight)

  const ageMonths =
    pet?.birth_date
      ? ageInMonths(
          pet.birth_date,
          new Date()
        )
      : null

  const weightControl =
    /肥胖|過重/.test(
      String(healthSummary || '')
    )

  let targetKcal = null

  try {
    const estimate =
      estimateTargetKcal({
        species:
          pet?.species,

        weightKg:
          Number.isFinite(weightKg) &&
          weightKg > 0
            ? weightKg
            : null,

        ageMonths,
        goal:
          'maintain',
        weightControl
      })

    targetKcal =
      Number.isFinite(
        estimate?.kcal
      )
        ? estimate.kcal
        : null
  } catch (err) {
    targetKcal = null
  }

  const avg =
    history.avgDailyCalories || 0

  if (targetKcal) {
    const ratio =
      avg / targetKcal

    if (ratio >= 1.15) {
      return {
        type:
          'high_calories',

        title:
          '近期餵食熱量偏高',

        recommendation:
          '下一餐把份量減少約 15%，主食不用更換。',

        reason:
          `近期有紀錄的日子平均約 ${avg} kcal／日，` +
          `超過建議攝取約 ${Math.round((ratio - 1) * 100)}%` +
          `（建議約 ${targetKcal} kcal／日）。`
      }
    }

    if (ratio <= 0.85) {
      return {
        type:
          'low_calories',

        title:
          '近期餵食熱量偏低',

        recommendation:
          '可以維持平常份量餵食；若食慾下降或持續偏低，建議諮詢獸醫。',

        reason:
          `近期有紀錄的日子平均約 ${avg} kcal／日，` +
          `低於建議攝取約 ${Math.round((1 - ratio) * 100)}%` +
          `（建議約 ${targetKcal} kcal／日）。`
      }
    }

    return {
      type:
        'normal',

      title:
        '近期飲食狀況穩定',

      recommendation:
        '最近的熱量攝取和建議相符，維持目前的餵法即可。',

      reason:
        `近期有紀錄的日子平均約 ${avg} kcal／日，` +
        `建議約 ${targetKcal} kcal／日（依體重估算）。`
    }
  }

  return {
    type:
      'normal',

    title:
      '近期飲食狀況穩定',

    recommendation:
      '最近的熱量攝取沒有明顯偏差，維持目前餵法並持續記錄。',

    reason:
      `系統已分析最近 ${history.mealCount} 筆餵食紀錄；` +
      `補上寵物體重後，就能判斷是否在建議範圍內。`
  }
}

/* =========================================================
   檢查新選擇的食物
========================================================= */

function checkFoodWarning({
  pet,
  food,
  history,
  healthSummary = '',

  /*
   * 名稱除了營養分析回傳的 food_name，也要比對原本的輸入：
   * 圖片辨識的名字、手動輸入的名字、資料庫的名字。
   * （營養查詢有時把名字改寫，只比對它會躲過規則）
   */
  extraNames = []
}) {
  const warnings = []


  /*
   * 危險食物
   * 完整清單與理由在 services/foodSafety.js（貓／狗不能吃的食物）。
   * 那邊决定 level 與文字，這裡只負責放進統一的警告格式。
   */

  for (
    const unsafe
    of matchUnsafeFoodRules({
      species:
        pet?.species,

      names: [
        food?.food_name,
        ...extraNames
      ]
    })
  ) {
    warnings.push({
      level:
        unsafe.level,

      ...(
        unsafe.requireAck === false
          ? { requireAck: false }
          : {}
      ),

      check: 'nutrition',

      kind: 'unsafe_food',

      ruleId:
        unsafe.id,

      title:
        unsafe.title,

      reason:
        unsafe.reason,

      suggestion:
        unsafe.suggestion
    })
  }


  /*
   * 一般只關注熱量：不再根據近期脂肪／纖維比例產生警訊
   */

  /*
   * 體重過重 / 肥胖
   */

  const healthText =
    String(
      healthSummary || ''
    )


  if (
    (
      healthText.includes('肥胖') ||
      healthText.includes('過重')
    ) &&
    (
      toSafeNumber(
        food.calories_per_100g
      ) >=
        DIET_RULES.highCalories
    )
  ) {
    warnings.push({
      level: 'warning',

      check: 'health',

      kind: 'obesity_calories',

      title:
        '目前健康狀況需注意熱量攝取',

      reason:
        '健康紀錄中有體重過重相關資訊，而目前選擇的食物熱量較高。',

      suggestion:
        '建議注意餵食份量，並優先選擇熱量較低且營養完整的食物。'
    })
  }


  return warnings
}


/* =========================================================
   餵食前檢查流程（「自己選擇」與「依照飲食計畫」共用）

   1. 健康歷史與飼主偏好  (check: 'health')
   2. 近期飲食            (check: 'recentDiet')
   3. 營養與食物安全      (check: 'nutrition')

   回傳 warnings（全部）與 checks（依階段分組，給前端顯示流程）
========================================================= */

function evaluateFood({
  pet,
  food,
  category,
  history = null,
  healthSummary = '',
  baseWarnings,
  events = [],
  prefs = null,
  recentRecords = []
}) {
  const base =
    baseWarnings ??
    checkFoodWarning({ pet, food, history, healthSummary })

  const desc = {
    name: food.food_name,
    category,
    fatPer100g: food.fat_pct
  }

  const warnings = [
    ...base,
    ...buildOwnerPreferenceWarnings({ food: desc, prefs }),
    ...buildHealthHistoryWarnings({ food: desc, events }),
    ...buildNutritionChecks({ pet, food: desc }),
    ...buildRecentDietWarnings({ food: desc, recentRecords })
  ]

  const checks = { health: [], recentDiet: [], nutrition: [] }

  for (const w of warnings) {
    ;(checks[w.check] || checks.nutrition).push(w)
  }

  return { warnings, checks }
}

// 讀取某隻寵物的檢查背景：飼主偏好、近期健康事件、最近 3 天餵食
async function loadPetDietContext(petId) {
  const [petResult, events, recent] = await Promise.all([
    pool.query(
      'SELECT diet_preferences FROM pets WHERE id = $1',
      [petId]
    ),
    getRecentDietEvents(petId),
    pool.query(
      `
      SELECT food_name, to_char(fed_at, 'YYYY-MM-DD') AS day
      FROM feeding_records
      WHERE pet_id = $1
        AND fed_at >= (NOW() AT TIME ZONE $2::text)::date - 2
      ORDER BY fed_at DESC
      `,
      [petId, DIET_TZ]
    )
  ])

  return {
    prefs: sanitizePreferences(petResult.rows[0]?.diet_preferences),
    events,
    recentRecords: recent.rows.map(r => ({
      foodName: r.food_name,
      day: r.day
    }))
  }
}


/* =========================================================
   取得所有食物
========================================================= */

router.get(
  '/',
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT *
          FROM food_items
          WHERE owner_id = $1
             OR is_preset = TRUE
          ORDER BY
            is_preset DESC,
            name ASC
          `,
          [req.userId]
        )


      return res.json({
        success: true,
        data: result.rows
      })

    } catch (err) {
      console.error(
        'get foods error:',
        err
      )

      return res
        .status(500)
        .json({
          success: false,
          error:
            '取得食物資料失敗'
        })
    }
  }
)


/* =========================================================
   新增自訂食物
========================================================= */

router.post(
  '/',
  async (req, res) => {
    const {
      name,
      category,
      brand,

      calories_per_100g,
      protein_pct,
      fat_pct,
      carb_pct,
      fiber_pct
    } = req.body


    if (!name) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            '請輸入食物名稱'
        })
    }


    try {
      const result =
        await pool.query(
          `
          INSERT INTO food_items
          (
            owner_id,
            name,
            category,
            brand,
            calories_per_100g,
            protein_pct,
            fat_pct,
            carb_pct,
            fiber_pct
          )
          VALUES
          (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9
          )
          RETURNING *
          `,
          [
            req.userId,

            name,

            category ||
              'other',

            brand ||
              null,

            toSafeNumber(
              calories_per_100g
            ),

            toSafeNumber(
              protein_pct
            ),

            toSafeNumber(
              fat_pct
            ),

            toSafeNumber(
              carb_pct
            ),

            toSafeNumber(
              fiber_pct
            )
          ]
        )


      return res.json({
        success: true,
        data: result.rows[0]
      })

    } catch (err) {
      console.error(
        'create food error:',
        err
      )

      return res
        .status(500)
        .json({
          success: false,
          error:
            '新增食物失敗'
        })
    }
  }
)


/* =========================================================
   刪除自訂食物
========================================================= */

router.delete(
  '/:id',
  async (req, res) => {
    try {
      await pool.query(
        `
        DELETE FROM food_items
        WHERE id = $1
          AND owner_id = $2
        `,
        [
          req.params.id,
          req.userId
        ]
      )


      return res.json({
        success: true
      })

    } catch (err) {
      console.error(
        'delete food error:',
        err
      )

      return res
        .status(500)
        .json({
          success: false,
          error:
            '刪除食物失敗'
        })
    }
  }
)


/* =========================================================
   修改自訂食物（預設食物不可修改）
========================================================= */

router.put(
  '/:id',
  async (req, res) => {
    const {
      name,
      category,
      brand,

      calories_per_100g,
      protein_pct,
      fat_pct,
      carb_pct,
      fiber_pct
    } = req.body


    if (
      !name ||
      !String(name).trim()
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            '請輸入食物名稱'
        })
    }


    try {
      const result =
        await pool.query(
          `
          UPDATE food_items
          SET name = $3,
              category = $4,
              brand = $5,
              calories_per_100g = $6,
              protein_pct = $7,
              fat_pct = $8,
              carb_pct = $9,
              fiber_pct = $10
          WHERE id = $1
            AND owner_id = $2
          RETURNING *
          `,
          [
            req.params.id,
            req.userId,

            String(name).trim(),

            category ||
              'other',

            brand ||
              null,

            toSafeNumber(
              calories_per_100g
            ),

            toSafeNumber(
              protein_pct
            ),

            toSafeNumber(
              fat_pct
            ),

            toSafeNumber(
              carb_pct
            ),

            toSafeNumber(
              fiber_pct
            )
          ]
        )


      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              '找不到這個食物（預設食物不可編輯）'
          })
      }


      return res.json({
        success: true,
        data: result.rows[0]
      })

    } catch (err) {
      console.error(
        'update food error:',
        err
      )

      return res
        .status(500)
        .json({
          success: false,
          error:
            '儲存食物失敗'
        })
    }
  }
)


/* =========================================================
   初始化預設食物
========================================================= */

router.post(
  '/init-presets',
  async (req, res) => {
    try {
      for (
        const food
        of PRESET_FOODS
      ) {
        await pool.query(
          `
          INSERT INTO food_items
          (
            owner_id,
            name,
            category,
            brand,
            calories_per_100g,
            protein_pct,
            fat_pct,
            carb_pct,
            fiber_pct,
            is_preset
          )
          VALUES
          (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,TRUE
          )
          ON CONFLICT DO NOTHING
          `,
          [
            req.userId,

            food.name,
            food.category,
            food.brand,

            food.calories_per_100g,
            food.protein_pct,
            food.fat_pct,
            food.carb_pct,
            food.fiber_pct
          ]
        )
      }


      return res.json({
        success: true
      })

    } catch (err) {
      console.error(
        'init presets error:',
        err
      )

      return res
        .status(500)
        .json({
          success: false,
          error:
            '初始化食物失敗'
        })
    }
  }
)


/* =========================================================
   AI 文字分析食物
========================================================= */

router.post(
  '/ai-analyze',
  async (req, res) => {
    try {
      const {
        foodName
      } = req.body


      if (!foodName) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              '請輸入食物名稱'
          })
      }


      const nutrition =
        await analyzeNutrition(
          foodName
        )


      return res.json({
        success: true,
        data: nutrition
      })

    } catch (err) {
      console.error(
        'ai-analyze error:',
        err
      )

      return res
        .status(500)
        .json({
          success: false,
          error:
            'AI 營養分析失敗'
        })
    }
  }
)


/* =========================================================
   AI 圖片辨識食物
========================================================= */

router.post(
  '/ai-analyze-image',
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              '沒有圖片'
          })
      }


      const foodName =
        await detectFood(req)

      // detectFood 回 null 代表 Gemini 失敗（服務暫時忙），
      // 不要繼續硬湊成「未知食物」，直接請使用者稍後重試。
      if (foodName === null) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              '圖片辨識服務暫時用量飽和，等一下再按一次「開始辨識」即可'
          })
      }


      const nutrition =
        await analyzeNutrition(
          foodName
        )


      return res.json({
        success: true,

        data: {
          ...nutrition,

          food_name:
            nutrition.food_name ||
            foodName,

          image_food_name:
            foodName,

          notes:
            `已辨識為 ${foodName}`
        }
      })

    } catch (err) {
      console.error(
        'ai-analyze-image error:',
        err
      )


      return res
        .status(500)
        .json({
          success: false,

          error:
            '圖片食物分析失敗',

          detail:
            err.message
        })
    }
  }
)


/* =========================================================
   核心：
   智慧飲食推薦 + 飲食警訊

   前端傳：

   {
      pet,
      healthSummary,
      recentMeals,
      selectedFood
   }

   selectedFood 沒傳：
   → 只產生推薦

   selectedFood 有傳：
   → 推薦 + 新食物警訊
========================================================= */

router.post(
  '/smart-diet',
  async (req, res) => {
    try {
      const {
        pet,

        healthSummary = '',

        recentMeals = [],

        selectedFood = null
      } = req.body


      if (!pet) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              '缺少寵物資料'
          })
      }


      /*
       * 最多分析最近 10 筆
       */

      const normalizedMeals =
        await Promise.all(
          recentMeals
            .slice(0, 10)
            .map(
              meal =>
                normalizeMeal(
                  meal
                )
            )
        )


      /*
       * 分析歷史
       */

      const history =
        analyzeDietHistory(
          normalizedMeals
        )


      /*
       * 產生推薦
       */

      const recommendation =
        buildRecommendation(
          pet,
          history,
          healthSummary
        )


      let selectedNutrition =
        null

      let warnings = []


      /*
       * 使用者另外輸入食物
       */

      if (selectedFood) {
        const selected =
          typeof selectedFood ===
          'string'
            ? {
                food_name:
                  selectedFood
              }
            : selectedFood


        const selectedFoodName =
          selected.food_name ||
          selected.foodName ||
          selected.name


        if (selectedFoodName) {

          /*
           * 已經有營養資料
           */

          if (
            selected.calories_per_100g !==
              undefined &&
            selected.calories_per_100g !==
              null
          ) {
            selectedNutrition = {
              food_name:
                selectedFoodName,

              calories_per_100g:
                toSafeNumber(
                  selected.calories_per_100g
                ),

              protein_pct:
                toSafeNumber(
                  selected.protein_pct
                ),

              fat_pct:
                toSafeNumber(
                  selected.fat_pct
                ),

              carb_pct:
                toSafeNumber(
                  selected.carb_pct
                ),

              fiber_pct:
                toSafeNumber(
                  selected.fiber_pct
                )
            }

          } else {

            /*
             * 沒有營養資料
             * → AI 自動分析
             */

            selectedNutrition =
              await analyzeNutrition(
                selectedFoodName
              )
          }


          /*
           * 食物警訊
           */

          warnings =
            checkFoodWarning({
              pet,

              food:
                selectedNutrition,

              history,

              healthSummary,

              // 使用者輸入的原名也要比對（nutrition 的名字可能被改寫）
              extraNames: [
                selectedFoodName,
                selected.image_food_name
              ]
            })
        }
      }


      return res.json({
        success: true,

        data: {

          /*
           * 原始歷史資料
           */

          recentMeals:
            normalizedMeals,

          /*
           * 近幾餐分析
           */

          history,

          /*
           * 下一餐推薦
           */

          recommendation,

          /*
           * 使用者輸入的新食物
           */

          selectedNutrition,

          /*
           * 警告
           */

          hasWarning:
            warnings.length > 0,

          warnings
        }
      })

    } catch (err) {
      console.error(
        'smart-diet error:',
        err
      )


      return res
        .status(500)
        .json({
          success: false,

          error:
            '智慧飲食分析失敗',

          detail:
            err.message
        })
    }
  }
)


/* =========================================================
   單獨檢查食物

   可以在使用者選擇食物時立刻呼叫
========================================================= */

router.post(
  '/check-food',
  async (req, res) => {
    try {
      const {
        pet,

        healthSummary = '',

        recentMeals = [],

        // ⭐ 新增：有帶 petId 時，後端會自己讀取該寵物的健康歷史
        petId,

        food
      } = req.body


      if (!pet) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              '缺少寵物資料'
          })
      }


      if (!food) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              '缺少食物資料'
          })
      }


      const normalizedMeals =
        await Promise.all(
          recentMeals
            .slice(0, 10)
            .map(
              meal =>
                normalizeMeal(
                  meal
                )
            )
        )


      const history =
        analyzeDietHistory(
          normalizedMeals
        )


      const foodObject =
        typeof food ===
        'string'
          ? {
              food_name:
                food
            }
          : food


      const foodName =
        foodObject.food_name ||
        foodObject.foodName ||
        foodObject.name


      if (!foodName) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              '缺少食物名稱'
          })
      }


      let nutrition


      if (
        foodObject.calories_per_100g !==
          undefined &&
        foodObject.calories_per_100g !==
          null
      ) {
        nutrition = {
          food_name:
            foodName,

          calories_per_100g:
            toSafeNumber(
              foodObject.calories_per_100g
            ),

          protein_pct:
            toSafeNumber(
              foodObject.protein_pct
            ),

          fat_pct:
            toSafeNumber(
              foodObject.fat_pct
            ),

          carb_pct:
            toSafeNumber(
              foodObject.carb_pct
            ),

          fiber_pct:
            toSafeNumber(
              foodObject.fiber_pct
            )

        }

      } else {
        nutrition =
          await analyzeNutrition(
            foodName
          )
      }


      const warnings =
        checkFoodWarning({
          pet,

          food:
            nutrition,

          history,

          healthSummary,

          /*
           * 營養查詢有時把名稱改寫（例如「洋蔥牛肉湯」變成「牛肉湯」），
           * 只比對 nutrition.food_name 會躲過安全規則。
           * 所以圖片辨識的名字（image_food_name）與使用者輸入的名字都要一起比對。
           */
          extraNames: [
            foodName,
            foodObject.image_food_name
          ]
        })


      /*
       * ⭐ 餵食前檢查流程：
       *   健康歷史與飼主偏好 → 近期飲食 → 營養與食物安全
       *
       * 有帶 petId 時，後端會自己讀取這隻寵物的健康歷史、
       * 飼主偏好與最近 3 天的餵食紀錄。
       * 新增的警訊都只是提醒（requireAck: false），
       * 只有「飼主自己設定要避免」的食物需要確認。
       * 讀取失敗時不影響原本的檢查結果。
       */

      let context = {
        prefs: null,
        events: [],
        recentRecords: []
      }

      try {
        if (
          petId &&
          await ownsPet(
            petId,
            req.userId
          )
        ) {
          context =
            await loadPetDietContext(
              petId
            )
        }

      } catch (contextErr) {
        console.error(
          '讀取寵物飲食背景失敗（不影響原本檢查）：',
          contextErr
        )
      }


      const evaluated =
        evaluateFood({
          pet,

          food:
            nutrition,

          category:
            foodObject.category,

          baseWarnings:
            warnings,

          ...context
        })

      const allWarnings =
        evaluated.warnings


      return res.json({
        success: true,

        data: {
          food:
            nutrition,

          history,

          safe:
            allWarnings.length === 0,

          hasWarning:
            allWarnings.length > 0,

          warnings:
            allWarnings,

          checks:
            evaluated.checks
        }
      })

    } catch (err) {
      console.error(
        'check-food error:',
        err
      )


      return res
        .status(500)
        .json({
          success: false,

          error:
            '飲食警訊檢查失敗',

          detail:
            err.message
        })
    }
  }
)


/* =========================================================
   AI 整體飲食建議（個人化建議＋追加提問）

   與飲食管理頁面的操作流程對應：
   1. 輸入：寵物資料＋當日飲食紀錄＋近期飲食＋健康狀況
   2. 向知識庫檢索與情況相關的資料（與健康諮詢同一套 RAG）
   3. 產生個人化建議；附 question（追加提問）時，
      依相同資料回答問題
   4. 一併回傳參考資料來源，由前端顯示

   餵食定位（依獸醫意見）：
   平日就是固定餵食商業飼料，營養由飼料本身提供，
   建議以「熱量攝取與下一餐份量」為核心；
   只有在身體狀況需要時才考慮暫換食物。
========================================================= */

// 與前端飲食頁面相同的估算：RER × 1.4（成年絕育犬貓的粗略值）
function dailyCalorieTarget(weight) {
  const w = toSafeNumber(weight, 0)

  if (!w) return null

  return Math.round(70 * Math.pow(w, 0.75) * 1.4)
}

router.post(
  '/diet-advice',
  async (req, res) => {
    try {
      const {
        pet,

        healthSummary = '',

        recentMeals = [],

        dayMeals = [],

        dayLabel = '今日',

        nutritionTarget = null,

        dayStatus = '',

        question = ''
      } = req.body


      if (!pet) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              '缺少寵物資料'
          })
      }


      /*
       * 年齡
       */

      const age = formatAge(ageInMonths(pet.birth_date)) || '年齡不明'


      /*
       * 最近飲食
       */

      const normalizedMeals =
        await Promise.all(
          recentMeals
            .slice(0, 10)
            .map(
              meal =>
                normalizeMeal(
                  meal
                )
            )
        )


      const history =
        analyzeDietHistory(
          normalizedMeals
        )


      /*
       * 當日飲食紀錄（餵食頁面上顯示的那一天）
       * 個人化建議必須先看到「今天已經吃了什麼」
       */

      const normalizedDayMeals =
        await Promise.all(
          dayMeals
            .slice(0, 12)
            .map(
              meal =>
                normalizeMeal(
                  meal
                )
            )
        )

      const dayMealLines =
        normalizedDayMeals.length === 0
          ? [`${dayLabel}目前沒有餵食紀錄。`]
          : normalizedDayMeals.map(meal => {
              const parts = [
                `- ${meal.food_name} ${meal.amount_g}g`
              ]

              if (meal.calories_per_100g)
                parts.push(
                  `約 ${Math.round(meal.amount_g * meal.calories_per_100g / 100)} kcal`
                )

              return parts.join('（') + (parts.length > 1 ? '）' : '')
            })

      const dayCalories =
        normalizedDayMeals.reduce(
          (sum, meal) =>
            sum +
            (meal.calories_per_100g
              ? meal.amount_g * meal.calories_per_100g / 100
              : 0),
          0
        )


      /*
       * 熱量檢查：以「每日建議範圍」為核心，
       * 不把單一數字當成所有寵物的固定標準。
       */

      const hasDayData = normalizedDayMeals.length > 0

      const rangeTarget = Number(nutritionTarget?.targetKcal)
      const rangeMin = Number(nutritionTarget?.minKcal)
      const rangeMax = Number(nutritionTarget?.maxKcal)

      const calorieTarget =
        Number.isFinite(rangeTarget) && rangeTarget > 0
          ? Math.round(rangeTarget)
          : dailyCalorieTarget(pet.weight)

      const calorieMin =
        Number.isFinite(rangeMin) && rangeMin > 0
          ? Math.round(rangeMin)
          : calorieTarget === null
            ? null
            : Math.round(calorieTarget * 0.8)

      const calorieMax =
        Number.isFinite(rangeMax) && rangeMax > 0
          ? Math.round(rangeMax)
          : calorieTarget === null
            ? null
            : Math.round(calorieTarget * 1.1)

      const statusText =
        dayStatus ||
        (!hasDayData
          ? 'no_data'
          : calorieTarget === null
            ? 'no_target'
            : dayCalories < calorieMin
              ? 'under'
              : dayCalories > calorieMax
                ? 'over'
                : 'in_range')

      const statusLabel = {
        no_data: '這一天尚無餵食紀錄',
        no_target: '資料不足，無法估算建議範圍',
        under: '低於建議範圍',
        in_range: '在建議範圍內',
        over: '超出建議範圍'
      }[statusText] || ''

      const overKcal =
        calorieMax === null || !hasDayData
          ? 0
          : Math.max(Math.round(dayCalories - calorieMax), 0)

      const underKcal =
        calorieMin === null || !hasDayData
          ? 0
          : Math.max(Math.round(calorieMin - dayCalories), 0)

      const overGrams =
        overKcal && history.avgCaloriesPer100g
          ? Math.round((overKcal / history.avgCaloriesPer100g) * 100)
          : null

      const calorieCheckLines = !hasDayData
        ? [
            `${dayLabel}目前沒有餵食紀錄，無法判斷是否在建議範圍內，請先新增餵食紀錄。`,
            calorieTarget === null
              ? '目前也缺少體重或物種資料，無法估算每日建議範圍。'
              : `每日建議熱量約 ${calorieTarget} kcal（建議範圍 ${calorieMin}–${calorieMax} kcal／日）。`
          ]
        : calorieTarget === null
          ? [
              '無法估算每日建議範圍（缺少體重或物種資料），下一餐請維持平常份量，並建議補上寵物體重。'
            ]
          : [
              `每日建議熱量：約 ${calorieTarget} kcal／日（建議範圍 ${calorieMin}–${calorieMax} kcal／日）。`,
              `${dayLabel}實際攝取：約 ${Math.round(dayCalories)} kcal，約為建議值的 ${Math.round(dayCalories / calorieTarget * 100)}%。`,
              `目前狀態：${statusLabel}。`,
              overKcal > 0
                ? `已超過建議上限約 ${overKcal} kcal，下一餐應減量。`
                : underKcal > 0
                  ? `距離建議下限還有約 ${underKcal} kcal，可視情況補足。`
                  : '攝取量落在建議範圍內，維持目前份量即可。'
            ]

      // 下一餐份量的系統判斷（AI 與離線降級都共用）
      const portionHint = !hasDayData
        ? '先記錄實際餵食內容，才能依今日攝取量調整下一餐。'
        : calorieTarget === null
          ? '下一餐維持平常份量。'
          : statusText === 'over'
            ? `下一餐請維持同一種飼料但減少份量${overGrams ? `（約少餵 ${overGrams}g）` : ''}。`
            : statusText === 'under'
              ? `下一餐可維持平常份量，讓整天攝取接近建議範圍；若持續不足再與獸醫討論。`
              : `下一餐可維持平常份量，繼續觀察體重與每日攝取趨勢。`


      /*
       * 知識庫檢索（與健康諮詢共用同一套 RAG）
       * 有追加提問就用問題檢索；沒有就用健康狀況，
       * 讓嘔吐、腹瀉等情況能帶出對應的飲食資料。
       * 任何失敗都只是沒有參考資料，不影響建議產生。
       */

      let knowledge = []

      try {
        const kbQuestion =
          String(question || '').trim() ||
          String(healthSummary || '')
            .trim()
            .slice(0, 600) ||
          `${pet.species || '寵物'} 飲食 熱量 份量`

        if (kbQuestion) {
          knowledge =
            await retrieveKnowledge({
              question: kbQuestion,

              species: pet.species,

              limit: 3
            })
        }
      } catch (kbErr) {
        console.error(
          'diet-advice 知識庫檢索失敗（已略過）：',
          kbErr.message
        )

        knowledge = []
      }

      const knowledgeBlock =
        formatKnowledgeForPrompt(knowledge)

      const adviceSources =
        knowledge.map(item => ({
          title: item.title,

          source: item.sourceName,

          url: item.sourceUrl
        }))


      /*
       * 規則式回答（AI 沒有 API KEY、呼叫失敗或回空內容時的降級）
       * 健康問題優先給安全做法，熱量資料作為輔助。
       */
      const buildRuleBasedAdvice = () => {
        const q =
          String(question || '').trim()

        const probe =
          `${q}\n${healthSummary || ''}`

        const healthLines = []

        // 先放知識庫的內容：資料庫有相關資料時，優先給資料庫的說法
        const kbTop =
          Array.isArray(knowledge) && knowledge.length > 0
            ? knowledge[0]
            : null

        if (kbTop) {
          healthLines.push(
            `依獸醫資料庫「${kbTop.title}」：` +
              (kbTop.content.length > 200
                ? kbTop.content.slice(0, 200) + '…'
                : kbTop.content) +
              `\n（來源：${kbTop.sourceName}，詳見下方參考資料）`
          )
        }

        // 依知識庫分級判斷是否需要升級就醫警訊
        const kbEmergency =
          (knowledge || []).some(item =>
            /^emergency/.test(item.severityHint || '')
          )
        const kbUrgent =
          (knowledge || []).some(item =>
            /^urgent/.test(item.severityHint || '')
          )

        if (kbEmergency) {
          healthLines.push(
            '知識庫分級：此主題屬於緊急狀況，',
            '請立即聯絡獸醫或寵物急診，不要先自行處理。'
          )
        } else if (kbUrgent && /嘔吐|腹瀉|拉肚子|血便/.test(probe)) {
          healthLines.push(
            '知識庫分級：此主題建議儘速就醫；',
            '若症狀持續或加重，請優先聯絡獸醫。'
          )
        }

        if (
          /中毒|毒物|木糖醇|巧克力|葡萄|洋蔥|老鼠藥/.test(
            probe
          )
        ) {
          healthLines.push(
            '你提到疑似中毒：這是緊急狀況，',
            '請立即聯絡獸醫或寵物急診，不要先自行餵食、催吐或餵藥；',
            '把可疑的食物、包裝或成分帶給獸醫參考。'
          )
        } else if (/嘔吐|吐/.test(probe)) {
          healthLines.push(
            '你提到嘔吐：近期先不要嘗試新食物；',
            '可先暫停餵食數小時，等精神與食慾回穩，',
            '再以少量、平常耐受的清淡食物分多次少量餵食；',
            '確保隨時有清水。',
            '嘔吐持續、吐出血絲、伴隨腹瀉／發燒／沒有食慾，',
            '請立即聯絡獸醫，飲食調整不能取代就醫。'
          )
        } else if (/腹瀉|拉肚子|軟便|血便/.test(probe)) {
          healthLines.push(
            '你提到腹瀉：先給平常耐受的清淡食物、',
            '少量多餐，避免高脂與新食物；',
            '注意補水。若拉肚子持續超過一天、有血便，',
            '或合併嘔吐、精神差，請聯絡獸醫。'
          )
        } else if (
          /食慾.*(下降|不佳|沒有|差)|沒胃口|不肯吃|精神.*(不好|差|不振|低落)/.test(
            probe
          )
        ) {
          healthLines.push(
            '你提到食慾或精神下降：先少量餵平常耐受的食物、',
            '確保水分，並觀察體重變化；',
            '若持續超過一天，或合併嘔吐／腹瀉／發燒，請先就醫評估。'
          )
        } else if (q) {
          healthLines.push(
            `你提到「${q.slice(0, 60)}」。`,
            '這裡沒有相關就醫紀錄，以下僅供參考：',
            '維持固定飼料、注意份量、觀察精神與食慾；',
            '若症狀持續或加重，請先諮詢獸醫。'
          )
        }

        const parts = []

        if (
          q &&
          healthLines.length > 0
        ) {
          parts.push(
            `**針對你的問題**\n\n${healthLines.join('\n')}`
          )
        }

        parts.push(
          `**${dayLabel}熱量攝取狀況**\n\n${calorieCheckLines.join('\n')}`
        )

        parts.push(
          `**下一餐份量建議**\n\n${portionHint}`
        )

        parts.push(
          '**餵食注意事項**\n\n' +
            '維持固定飼料，不需要額外更換食物或補充營養；' +
            '若出現嘔吐、腹瀉等身體狀況，下一餐份量改以腸胃承受度為優先，' +
            '症狀持續或反覆出現請先就醫。'
        )

        return parts.join('\n\n')
      }


      /*
       * 沒 Groq API Key
       * 仍可用系統熱量檢查與規則式回答給出基本建議
       */

      if (
        !process.env.GROQ_API_KEY
      ) {
        return res.json({
          success: true,

          data: {
            advice:
              buildRuleBasedAdvice(),

            history,

            sources: adviceSources
          }
        })
      }


      let raw = ''

      try {
        const completion =
          await groq.chat.completions.create({
            model:
              DEFAULT_GROQ_MODEL,

            messages: [
            {
              role: 'system',

              content: `
你是一位寵物飲食照護助手，服務的對象是飼主。

這個應用的餵食方式（必須遵守）：

- 寵物平常吃的是固定的商業飼料，不會隨意換食物；
  你的建議核心是「下一餐餵多少」（份量、熱量），
  不要推薦換食物、換食譜或新增食材。
- 商業主食飼料已提供均衡營養，
  不要評論脂肪、蛋白質、纖維的比例，也不要建議補充營養；
  除非健康紀錄或飼主的問題明確與身體狀況有關。
- 只有在健康紀錄或飼主問題顯示身體狀況需要時
  （例如嘔吐、腹瀉、腸胃不適），
  才可以建議暫時改餵較溫和易消化的食物，
  並提醒是否更換、更換成什麼請依獸醫指示。

回答原則（優先順序）：

1. 若飼主有提問，必須先直接回答該問題，
   至少用一半篇幅展開；不得用熱量分析蓋過健康問題。
2. 若問題或健康紀錄涉及身體不適（嘔吐、腹瀉、食慾下降、
   精神不振、外傷、疑似中毒等），
   回答必須以身體狀況為核心，優先給飲食面的安全做法：
   少量多餐、餵平常耐受的食物、避免嘗試新食物；
   嘔吐期間可先暫停餵食數小時，再以少量清爽食物分多次餵食；
   確保清水；觀察精神、食慾、排泄物。
   症狀持續、加重或涉及中毒、出血、呼吸困難時，
   必須明確要求立即聯絡獸醫，並說明飲食調整不能取代就醫。
3. 若資料中沒有相關就醫或健康紀錄，
   請明確說明「這裡沒有相關就醫紀錄，以下僅供參考」，
   給出一般性的安全做法，並提醒就醫評估。
4. 熱量分析可以放在最後，用 2–3 句帶過。

規則：

1. 使用繁體中文。
2. 不輸出思考過程。
3. 不使用 #。
4. 不要過度冗長。
5. 不要把 AI 建議描述成醫療診斷。
6. 若【參考資料】標示「緊急」或「應儘速就醫」，
   回答必須先明確要求立即聯絡獸醫，
   再談飲食面的做法；不得只給一般飲食調整建議。
   若資料分級為「症狀持續應儘速就醫」，
   而飼主描述的症狀已持續多天，同樣視為應儘速就醫。
${knowledgeBlock}
`
            },

            {
              role: 'user',

              content: `
${
  String(question || '').trim()
    ? `飼主的問題：

${String(question).trim().slice(0, 500)}

請先直接回答這個問題；健康問題先談健康，不要跳過直接講熱量。

`
    : ''
}寵物資料：

名稱：
${pet.name || '未知'}

種類：
${pet.species || '未知'}

品種：
${pet.breed || '未知'}

年齡：
${age}

體重：
${pet.weight
  ? `${pet.weight} kg`
  : '未知'}


健康紀錄：

${healthSummary ||
  '目前沒有健康紀錄'}


${dayLabel}已記錄的飲食：

${dayMealLines.join('\n')}

${dayLabel}合計攝取：
${hasDayData ? `約 ${Math.round(dayCalories)} kcal` : '尚無紀錄（不是 0 kcal）'}

每日建議熱量範圍：
${
  calorieTarget === null
    ? '資料不足，無法估算'
    : `建議 ${calorieTarget} kcal／日（最低 ${calorieMin}、最高 ${calorieMax} kcal／日）`
}

目前狀態：
${statusLabel || '未知'}


最近餵食概況（固定飼料的情況下，代表平常餵食量）：

紀錄數：
${history.mealCount}

平均熱量密度：
${history.avgCaloriesPer100g} kcal / 100g


系統熱量檢查：

${calorieCheckLines.join('\n')}


請依序輸出（最多三個熱量相關段落，每段最多 3 行）：

${
  String(question || '').trim()
    ? '**針對你的問題**\n\n'
    : ''
}**${dayLabel}熱量攝取狀況**

**下一餐份量建議**

**建議原因**

**餵食注意事項**
`
            }
          ],

            temperature: 0.2,

            // gpt-oss 為推理模型，思考鏈會吃掉 token 預算，
            // 預算太小會只吐出半句（甚至空字串），所以給足夠空間
            max_completion_tokens:
              3000
          })

        raw =
          completion.choices?.[0]
            ?.message?.content ||
          ''
      } catch (groqErr) {
        console.error(
          'diet-advice Groq 呼叫失敗，改用規則式回答：',
          groqErr.message
        )

        raw = ''
      }


      let advice =
        normalizeText(raw)


      if (!advice) {
        advice =
          buildRuleBasedAdvice()
      }


      return res.json({
        success: true,

        data: {
          advice,

          history,

          sources: adviceSources
        }
      })

    } catch (err) {
      console.error(
        'diet-advice error:',
        err
      )


      return res
        .status(500)
        .json({
          success: false,

          error:
            'AI 飲食建議產生失敗',

          detail:
            err.message
        })
    }
  }
)



/* =========================================================
   今日飲食計畫
   GET /food/meal-plan/:petId

   依品種、貓／狗、年齡、體重、目前健康狀況、過往健康紀錄、
   飼主偏好，從食物資料庫挑選今天的建議餵食。
   每個候選食物都先經過與「自己選擇」相同的檢查流程。
========================================================= */

router.get(
  '/meal-plan/:petId',
  async (req, res) => {
    try {
      const petId = Number(req.params.petId)

      if (
        !Number.isInteger(petId) ||
        !(await ownsPet(petId, req.userId))
      ) {
        return res.status(404).json({
          success: false,
          error: '找不到寵物'
        })
      }

      const petResult = await pool.query(
        `
        SELECT
          id, name, species, breed, weight,
          to_char(birth_date, 'YYYY-MM-DD') AS birth_date
        FROM pets
        WHERE id = $1
        `,
        [petId]
      )

      const pet = petResult.rows[0]

      const context =
        await loadPetDietContext(petId)

      const [
        clock,
        foodsResult,
        healthResult,
        mealsResult
      ] = await Promise.all([
        pool.query(
          `SELECT to_char((NOW() AT TIME ZONE $1::text)::date, 'YYYY-MM-DD') AS today`,
          [DIET_TZ]
        ),

        pool.query(
          `
          SELECT *
          FROM food_items
          WHERE owner_id = $1
             OR is_preset = TRUE
          ORDER BY is_preset DESC, id ASC
          `,
          [req.userId]
        ),

        // 過往健康紀錄（用來判斷是否需要控制體重）
        pool.query(
          `
          SELECT title, description
          FROM health_records
          WHERE pet_id = $1
            AND date >= (NOW() AT TIME ZONE $2::text)::date - 90
          `,
          [petId, DIET_TZ]
        ),

        // 最近的餵食（用已儲存的營養數值換算成每 100g，避免再呼叫 AI）
        pool.query(
          `
          SELECT
            food_name,
            amount_g::float AS amount_g,
            calories::float AS calories,
            protein_g::float AS protein_g,
            fat_g::float AS fat_g,
            carb_g::float AS carb_g,
            to_char(fed_at, 'YYYY-MM-DD HH24:MI') AS fed_at
          FROM feeding_records
          WHERE pet_id = $1
            AND fed_at >= (NOW() AT TIME ZONE $2::text)::date - 6
            AND calories IS NOT NULL
            AND amount_g > 0
            AND amount_g <= 2000
          ORDER BY fed_at DESC
          LIMIT 10
          `,
          [petId, DIET_TZ]
        )
      ])

      const today = clock.rows[0].today

      const todayResult = await pool.query(
        `
        SELECT
          food_name,
          calories::float AS calories,
          meal_type,
          (EXTRACT(HOUR FROM fed_at) * 60
            + EXTRACT(MINUTE FROM fed_at))::int AS minutes
        FROM feeding_records
        WHERE pet_id = $1
          AND fed_at >= $2::date
          AND fed_at < ($2::date + 1)
        `,
        [petId, today]
      )

      const healthSummary = [
        ...healthResult.rows.map(
          r => `${r.title || ''} ${r.description || ''}`
        ),
        ...context.events.map(
          e => e.diet_info?.dietNotes || ''
        )
      ].join('\n')

      const weightControl =
        /肥胖|過重/.test(healthSummary)

      const normalizedMeals =
        await Promise.all(
          mealsResult.rows.map(r =>
            normalizeMeal({
              food_name: r.food_name,
              amount_g: r.amount_g,
              calories_per_100g:
                (r.calories / r.amount_g) * 100,
              protein_pct:
                ((r.protein_g ?? 0) / r.amount_g) * 100,
              fat_pct:
                ((r.fat_g ?? 0) / r.amount_g) * 100,
              carb_pct:
                ((r.carb_g ?? 0) / r.amount_g) * 100,
              fiber_pct: 0,
              fed_at: r.fed_at
            })
          )
        )

      const history =
        analyzeDietHistory(normalizedMeals)

      // 每個候選主食都跑一次和「自己選擇」相同的檢查流程
      const sKey =
        /cat|貓/i.test(pet.species || '')
          ? 'cat'
          : /dog|狗|犬/i.test(pet.species || '')
            ? 'dog'
            : null

      const warningsByFoodId = {}

      for (const f of foodsResult.rows) {
        if (!sKey || !isCandidateStaple(f, sKey)) continue

        const evaluated = evaluateFood({
          pet,

          food: {
            food_name: f.name,
            calories_per_100g: toSafeNumber(f.calories_per_100g),
            protein_pct: toSafeNumber(f.protein_pct),
            fat_pct: toSafeNumber(f.fat_pct),
            carb_pct: toSafeNumber(f.carb_pct),
            fiber_pct: toSafeNumber(f.fiber_pct)
          },

          category: f.category,
          history,
          healthSummary,
          ...context
        })

        // 計畫本身已經依體重狀況調整熱量，不必在每個選項重複顯示；
        // 「近期曾有…紀錄」也只在整體警示顯示一次，不在每餐重複。
        warningsByFoodId[f.id] =
          evaluated.warnings.filter(
            w => w.kind !== 'obesity_calories' && w.kind !== 'recent_event'
          )
      }

      const plan = buildMealPlan({
        pet,
        prefs: context.prefs,
        events: context.events,
        foods: foodsResult.rows,
        warningsByFoodId,
        todayRecords: todayResult.rows.map(r => ({
          foodName: r.food_name,
          calories: r.calories,
          minutes: r.minutes,
          mealType: r.meal_type
        })),
        weightControl,
        refDate: today
      })

      // 每日建議範圍（建議值／最低／最高）與今天的判斷結果
      try {
        const targets = await getTargetsForDates(petId, [today], {
          updateDate: today
        })

        const todayTarget = targets[today]

        if (todayTarget) {
          plan.target = {
            ...plan.target,
            kcal: todayTarget.targetKcal ?? plan.target.kcal,
            minKcal: todayTarget.minKcal,
            maxKcal: todayTarget.maxKcal,
            formulaVersion: todayTarget.formulaVersion,
            basis: todayTarget.basis
          }

          plan.today.targetKcal =
            todayTarget.targetKcal ?? plan.today.targetKcal

          const hasData = todayResult.rows.length > 0

          plan.today.hasData = hasData
          plan.today.status = rangeStatus(
            hasData ? plan.today.loggedKcal : null,
            todayTarget
          )
        }
      } catch (targetErr) {
        console.error('附加每日熱量建議範圍失敗：', targetErr.message)
      }

      res.json({
        success: true,
        data: plan
      })

    } catch (err) {
      console.error('產生飲食計畫失敗：', err)

      res.status(500).json({
        success: false,
        error: '伺服器錯誤'
      })
    }
  }
)

module.exports = router