const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')
const Groq = require('groq-sdk')
const multer = require('multer')

const { GoogleGenAI } = require('@google/genai')

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
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


    const response =
      await gemini.models.generateContent({
        model: 'gemini-3.6-flash',

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

只回答食物名稱。

不要解釋。
不要輸出 JSON。
不要輸出其他文字。

例如：

雞胸肉
鮭魚
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
        response.text || ''
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
      'Gemini Vision error:',
      err
    )

    return '未知食物'
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
  highFat: 12,
  veryHighFat: 18,

  lowFiber: 2,

  highCalories: 350
}


/* =========================================================
   危險食物規則
========================================================= */

const FOOD_SAFETY_RULES = [
  {
    species: [
      '狗',
      '犬',
      'dog',
      '貓',
      'cat'
    ],

    keywords: [
      '巧克力',
      '可可',
      'chocolate',
      'cocoa'
    ],

    level: 'danger',

    title:
      '不建議餵食巧克力',

    reason:
      '巧克力含有可能對犬貓造成健康風險的成分。'
  },

  {
    species: [
      '狗',
      '犬',
      'dog',
      '貓',
      'cat'
    ],

    keywords: [
      '洋蔥',
      'onion'
    ],

    level: 'danger',

    title:
      '不建議餵食洋蔥',

    reason:
      '洋蔥可能對犬貓造成健康風險。'
  },

  {
    species: [
      '狗',
      '犬',
      'dog',
      '貓',
      'cat'
    ],

    keywords: [
      '大蒜',
      '蒜頭',
      'garlic'
    ],

    level: 'danger',

    title:
      '不建議餵食大蒜',

    reason:
      '大蒜可能對犬貓造成健康風險。'
  },

  {
    species: [
      '狗',
      '犬',
      'dog'
    ],

    keywords: [
      '葡萄',
      '葡萄乾',
      'grape',
      'raisin'
    ],

    level: 'danger',

    title:
      '不建議犬隻食用葡萄',

    reason:
      '葡萄及葡萄乾可能對犬隻造成嚴重健康風險。'
  },

  {
    species: [
      '狗',
      '犬',
      'dog'
    ],

    keywords: [
      '木糖醇',
      'xylitol'
    ],

    level: 'danger',

    title:
      '不建議犬隻食用木糖醇',

    reason:
      '木糖醇可能對犬隻造成嚴重健康風險。'
  }
]


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
   歷史飲食分析
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

      avgProteinPct: 0,
      avgFatPct: 0,
      avgCarbPct: 0,
      avgFiberPct: 0,

      fatStatus: '資料不足',
      fiberStatus: '資料不足',
      calorieStatus: '資料不足'
    }
  }


  let totalWeight = 0

  let totalCalories = 0

  let totalProtein = 0
  let totalFat = 0
  let totalCarb = 0
  let totalFiber = 0


  for (const meal of meals) {
    const amount =
      Math.max(
        toSafeNumber(
          meal.amount_g,
          100
        ),
        1
      )


    const factor =
      amount / 100


    totalWeight += amount


    totalCalories +=
      toSafeNumber(
        meal.calories_per_100g
      ) * factor


    totalProtein +=
      toSafeNumber(
        meal.protein_pct
      ) * factor


    totalFat +=
      toSafeNumber(
        meal.fat_pct
      ) * factor


    totalCarb +=
      toSafeNumber(
        meal.carb_pct
      ) * factor


    totalFiber +=
      toSafeNumber(
        meal.fiber_pct
      ) * factor
  }


  const avgCaloriesPer100g =
    totalWeight > 0
      ? (
          totalCalories /
          totalWeight
        ) * 100
      : 0


  const avgProteinPct =
    totalWeight > 0
      ? (
          totalProtein /
          totalWeight
        ) * 100
      : 0


  const avgFatPct =
    totalWeight > 0
      ? (
          totalFat /
          totalWeight
        ) * 100
      : 0


  const avgCarbPct =
    totalWeight > 0
      ? (
          totalCarb /
          totalWeight
        ) * 100
      : 0


  const avgFiberPct =
    totalWeight > 0
      ? (
          totalFiber /
          totalWeight
        ) * 100
      : 0


  let fatStatus =
    '正常'


  if (
    avgFatPct >=
    DIET_RULES.veryHighFat
  ) {
    fatStatus =
      '明顯偏高'

  } else if (
    avgFatPct >=
    DIET_RULES.highFat
  ) {
    fatStatus =
      '偏高'
  }


  const fiberStatus =
    avgFiberPct <
    DIET_RULES.lowFiber
      ? '偏低'
      : '正常'


  const calorieStatus =
    avgCaloriesPer100g >=
    DIET_RULES.highCalories
      ? '偏高'
      : '正常'


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

    avgProteinPct:
      Number(
        avgProteinPct.toFixed(1)
      ),

    avgFatPct:
      Number(
        avgFatPct.toFixed(1)
      ),

    avgCarbPct:
      Number(
        avgCarbPct.toFixed(1)
      ),

    avgFiberPct:
      Number(
        avgFiberPct.toFixed(1)
      ),

    fatStatus,
    fiberStatus,
    calorieStatus
  }
}


/* =========================================================
   根據歷史飲食產生推薦
========================================================= */

function buildRecommendation(
  pet,
  history
) {
  if (!history.hasData) {
    return {
      type: 'no_data',

      title:
        '需要更多飲食紀錄',

      recommendation:
        '請先記錄幾次飲食，系統就能根據過去的營養攝取提供推薦。',

      reason:
        '目前沒有足夠的近期飲食資料。'
    }
  }


  const species =
    normalizeSpecies(
      pet?.species
    )


  const highFat =
    history.fatStatus ===
      '偏高' ||
    history.fatStatus ===
      '明顯偏高'


  const lowFiber =
    history.fiberStatus ===
    '偏低'


  const highCalories =
    history.calorieStatus ===
    '偏高'


  /*
   * 馬
   */

  if (
    species.includes('馬') ||
    species.includes('horse')
  ) {
    if (
      highFat &&
      lowFiber
    ) {
      return {
        type:
          'high_fat_low_fiber',

        title:
          '建議增加高纖草料',

        recommendation:
          '下一餐建議優先選擇適合的牧草或乾草，並減少高脂、高熱量精料。',

        reason:
          `近期平均脂肪約 ${history.avgFatPct}%，纖維約 ${history.avgFiberPct}%，目前呈現脂肪偏高、纖維偏低。`
      }
    }


    if (highFat) {
      return {
        type: 'high_fat',

        title:
          '近期脂肪攝取偏高',

        recommendation:
          '下一餐建議以較高纖的草料為主，減少高脂精料。',

        reason:
          `近期平均脂肪約 ${history.avgFatPct}%。`
      }
    }


    if (lowFiber) {
      return {
        type: 'low_fiber',

        title:
          '近期纖維攝取偏低',

        recommendation:
          '下一餐可適度增加適合的牧草或乾草比例。',

        reason:
          `近期平均纖維約 ${history.avgFiberPct}%。`
      }
    }
  }


  /*
   * 狗
   */

  if (
    species.includes('狗') ||
    species.includes('犬') ||
    species.includes('dog')
  ) {
    if (
      highFat &&
      lowFiber
    ) {
      return {
        type:
          'high_fat_low_fiber',

        title:
          '建議降低脂肪並增加纖維',

        recommendation:
          '下一餐建議選擇較低脂、營養完整的主食，並視情況選擇含適量纖維的食物。',

        reason:
          `近期平均脂肪約 ${history.avgFatPct}%，纖維約 ${history.avgFiberPct}%。`
      }
    }


    if (highFat) {
      return {
        type: 'high_fat',

        title:
          '近期脂肪攝取偏高',

        recommendation:
          '下一餐建議選擇較低脂的完整主食，並減少高脂零食。',

        reason:
          `近期平均脂肪約 ${history.avgFatPct}%。`
      }
    }


    if (lowFiber) {
      return {
        type: 'low_fiber',

        title:
          '近期纖維攝取較少',

        recommendation:
          '下一餐可選擇含適量纖維的完整主食。',

        reason:
          `近期平均纖維約 ${history.avgFiberPct}%。`
      }
    }
  }


  /*
   * 貓
   */

  if (
    species.includes('貓') ||
    species.includes('cat')
  ) {
    if (highFat) {
      return {
        type: 'high_fat',

        title:
          '近期脂肪攝取偏高',

        recommendation:
          '下一餐建議選擇較低脂且營養完整的貓咪主食，並減少高脂零食。',

        reason:
          `近期平均脂肪約 ${history.avgFatPct}%。`
      }
    }


    if (lowFiber) {
      return {
        type: 'low_fiber',

        title:
          '近期纖維來源較少',

        recommendation:
          '可選擇含適量纖維且營養完整的貓咪主食，不建議直接以蔬菜取代完整主食。',

        reason:
          `近期平均纖維約 ${history.avgFiberPct}%。`
      }
    }
  }


  if (highCalories) {
    return {
      type:
        'high_calories',

      title:
        '近期飲食熱量較高',

      recommendation:
        '下一餐可以優先選擇熱量較低且營養完整的食物，並注意份量。',

      reason:
        `近期食物平均約 ${history.avgCaloriesPer100g} kcal / 100g。`
    }
  }


  return {
    type: 'normal',

    title:
      '近期飲食狀況穩定',

    recommendation:
      '目前沒有發現明顯的營養偏差，可以維持目前飲食方式並持續記錄。',

    reason:
      `系統已分析最近 ${history.mealCount} 筆飲食紀錄。`
  }
}


/* =========================================================
   檢查新選擇的食物
========================================================= */

function checkFoodWarning({
  pet,
  food,
  history,
  healthSummary = ''
}) {
  const warnings = []


  const species =
    normalizeSpecies(
      pet?.species
    )


  const foodName =
    String(
      food?.food_name || ''
    ).toLowerCase()


  /*
   * 危險食物
   */

  for (
    const rule
    of FOOD_SAFETY_RULES
  ) {
    const speciesMatch =
      rule.species.some(
        item =>
          species.includes(
            item.toLowerCase()
          )
      )


    const foodMatch =
      rule.keywords.some(
        keyword =>
          foodName.includes(
            keyword.toLowerCase()
          )
      )


    if (
      speciesMatch &&
      foodMatch
    ) {
      warnings.push({
        level: rule.level,

        title:
          rule.title,

        reason:
          rule.reason,

        suggestion:
          '建議更換其他適合的食物。'
      })
    }
  }


  /*
   * 近期脂肪已偏高，
   * 新食物脂肪又高
   */

  const historyHighFat =
    history?.fatStatus ===
      '偏高' ||
    history?.fatStatus ===
      '明顯偏高'


  if (
    historyHighFat &&
    toSafeNumber(
      food?.fat_pct
    ) >=
      DIET_RULES.highFat
  ) {
    warnings.push({
      level: 'warning',

      title:
        '近期脂肪攝取已偏高',

      reason:
        `最近飲食平均脂肪約 ${history.avgFatPct}%，目前選擇的「${food.food_name}」脂肪約 ${food.fat_pct}g / 100g，持續攝取可能讓脂肪比例進一步升高。`,

      suggestion:
        '建議改選脂肪較低的食物，或調整本次餵食份量。'
    })
  }


  /*
   * 近期纖維偏低，
   * 新食物纖維也很低
   */

  if (
    history?.fiberStatus ===
      '偏低' &&
    toSafeNumber(
      food?.fiber_pct
    ) <
      DIET_RULES.lowFiber
  ) {
    warnings.push({
      level: 'info',

      title:
        '近期纖維攝取偏低',

      reason:
        `近期平均纖維約 ${history.avgFiberPct}%，目前選擇的「${food.food_name}」纖維含量也較低。`,

      suggestion:
        '可考慮選擇較符合目前需求、含適量纖維的完整食物。'
    })
  }


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
        DIET_RULES.highCalories ||
      toSafeNumber(
        food.fat_pct
      ) >=
        DIET_RULES.highFat
    )
  ) {
    warnings.push({
      level: 'warning',

      title:
        '目前健康狀況需注意熱量攝取',

      reason:
        '健康紀錄中有體重過重相關資訊，而目前選擇的食物熱量或脂肪較高。',

      suggestion:
        '建議注意餵食份量，並優先選擇熱量較低且營養完整的食物。'
    })
  }


  return warnings
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
          history
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

              healthSummary
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

          healthSummary
        })


      return res.json({
        success: true,

        data: {
          food:
            nutrition,

          history,

          safe:
            warnings.length === 0,

          hasWarning:
            warnings.length > 0,

          warnings
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
   AI 整體飲食建議

   原本 diet-advice 升級版
========================================================= */

router.post(
  '/diet-advice',
  async (req, res) => {
    try {
      const {
        pet,

        healthSummary = '',

        recentMeals = []
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

      const age =
        pet.birth_date
          ? (() => {
              const months =
                Math.floor(
                  (
                    Date.now() -
                    new Date(
                      pet.birth_date
                    )
                  ) /
                  (
                    1000 *
                    60 *
                    60 *
                    24 *
                    30.4
                  )
                )


              return months < 12
                ? `${months} 個月`
                : `${Math.floor(
                    months / 12
                  )} 歲`

            })()

          : '年齡不明'


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


      const recommendation =
        buildRecommendation(
          pet,
          history
        )


      /*
       * 沒 Groq API Key
       * 仍然可以使用規則推薦
       */

      if (
        !process.env.GROQ_API_KEY
      ) {
        return res.json({
          success: true,

          data: {
            advice:
              `${recommendation.title}\n\n${recommendation.recommendation}\n\n原因：${recommendation.reason}`,

            history,

            recommendation
          }
        })
      }


      const completion =
        await groq.chat.completions.create({
          model:
            DEFAULT_GROQ_MODEL,

          messages: [
            {
              role: 'system',

              content: `
你是一位寵物飲食照護助手。

請根據寵物資料、
健康紀錄與最近飲食紀錄，
提供簡單、實用的飲食建議。

規則：

1. 使用繁體中文。
2. 不輸出思考過程。
3. 不使用 #。
4. 不要過度冗長。
5. 最近飲食資料優先用來判斷下一餐應如何調整。
6. 不要把 AI 建議描述成醫療診斷。
7. 如果近期脂肪偏高，要提醒下一餐降低高脂食物。
8. 如果近期纖維偏低，應依寵物種類推薦適合的纖維來源或完整主食。
`
            },

            {
              role: 'user',

              content: `
寵物資料：

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


最近飲食分析：

紀錄數：
${history.mealCount}

平均熱量：
${history.avgCaloriesPer100g} kcal / 100g

平均蛋白質：
${history.avgProteinPct}%

平均脂肪：
${history.avgFatPct}%

脂肪狀態：
${history.fatStatus}

平均纖維：
${history.avgFiberPct}%

纖維狀態：
${history.fiberStatus}


系統規則推薦：

${recommendation.title}

${recommendation.recommendation}

原因：
${recommendation.reason}


請直接輸出：

**近期飲食分析**

**下一餐推薦**

**推薦原因**

**餵食注意事項**
`
            }
          ],

          temperature: 0.2,

          max_completion_tokens:
            900
        })


      const raw =
        completion.choices?.[0]
          ?.message?.content ||
        ''


      let advice =
        normalizeText(raw)


      if (!advice) {
        advice =
          `${recommendation.title}\n\n${recommendation.recommendation}\n\n原因：${recommendation.reason}`
      }


      return res.json({
        success: true,

        data: {
          advice,

          history,

          recommendation
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


module.exports = router