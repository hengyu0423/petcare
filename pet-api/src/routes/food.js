const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')
const Groq = require('groq-sdk')
const multer = require('multer')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const upload = multer({ storage: multer.memoryStorage() })
const { GoogleGenAI } = require('@google/genai')
const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

router.use(requireAuth)

// ✅ 文字分析用的模型
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'

/* ───────── 工具函式 ───────── */

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

function buildDefaultNutrition(foodName = '未知食物') {
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

function extractJsonObject(text) {
  const cleaned = normalizeText(text)
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

function isPlausibleFoodName(text) {
  const cleaned = normalizeText(text || '')
    .replace(/^['`]+|['"`]+$/g, '')
    .trim()
  if (!cleaned) return false
  if (cleaned.length > 20) return false
  if (/^[\W_]+$/.test(cleaned)) return false
  if (/^(thinking process|analysis|assistant|system|user|model|response|result|answer|content|food|image|unknown food|unknown)$/i.test(cleaned)) return false
  if (/分析|請求|用戶|思考|模型|格式|說明|結果|回答|內容|數據|熱量|蛋白質|脂肪|碳水|纖維|建議|醫療|症狀|process/i.test(cleaned)) return false
  if (/^\d+([.．]\d+)?(?:\s|$)/.test(cleaned)) return false
  return true
}

function extractFoodName(text) {
  const cleaned = normalizeText(text)
  if (!cleaned) return '未知食物'

  const lines = cleaned
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const candidate = line
      .replace(/^食物(?:名稱)?[:：\s]*/, '')
      .replace(/^辨識結果[:：\s]*/, '')
      .replace(/^答案[:：\s]*/, '')
      .replace(/^[\-\*\s]+/, '')
      .replace(/[。,.!?]+$/, '')
      .trim()

    if (candidate && isPlausibleFoodName(candidate)) {
      return candidate
    }
  }
  return '未知食物'
}

function toSafeNumber(val, fallback = 0) {
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

function getFallbackNutrition(foodName = '未知食物') {
  const normalizedName = String(foodName || '').toLowerCase().trim()

  if (
    normalizedName.includes('花椰菜') ||
    normalizedName.includes('花菜') ||
    normalizedName.includes('cauliflower')
  ) {
    return {
      ...buildDefaultNutrition(foodName),
      calories_per_100g: 25,
      protein_pct: 1.9,
      fat_pct: 0.3,
      carb_pct: 5,
      fiber_pct: 2
    }
  }

  if (
    normalizedName.includes('鮭魚') ||
    normalizedName.includes('三文魚') ||
    normalizedName.includes('salmon')
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
    normalizedName.includes('雞胸') ||
    normalizedName.includes('雞肉') ||
    normalizedName.includes('chicken')
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
    normalizedName.includes('牛肉') ||
    normalizedName.includes('beef')
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
    normalizedName.includes('豬肉') ||
    normalizedName.includes('pork')
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
    normalizedName.includes('雞蛋') ||
    normalizedName.includes('蛋') ||
    normalizedName.includes('egg')
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
    normalizedName.includes('白飯') ||
    normalizedName.includes('米飯') ||
    normalizedName.includes('rice')
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
    normalizedName.includes('地瓜') ||
    normalizedName.includes('番薯') ||
    normalizedName.includes('sweet potato')
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
    normalizedName.includes('南瓜') ||
    normalizedName.includes('pumpkin')
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
    normalizedName.includes('紅蘿蔔') ||
    normalizedName.includes('胡蘿蔔') ||
    normalizedName.includes('carrot')
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
    normalizedName.includes('罐頭') ||
    normalizedName.includes('wet') ||
    normalizedName.includes('濕食') ||
    normalizedName.includes('濕')
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
    normalizedName.includes('乾糧') ||
    normalizedName.includes('dry') ||
    normalizedName.includes('飼料') ||
    normalizedName.includes('糧')
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

/* ───────── AI 核心功能 ───────── */

// 根據食物名稱分析營養成分
async function analyzeNutrition(foodName) {
  if (!process.env.GROQ_API_KEY) {
    return getFallbackNutrition(foodName)
  }

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: `
你是營養資料分析模型。

任務：
根據食物名稱，估算每100克的營養資料。

規則：
1. 必須提供合理的營養數值。
2. 不可以因為不知道品牌而把營養數值設為0。
3. 一般天然食物使用常見食品營養資料估算。
4. 只有真的無法判斷食物時，才允許營養數值全部為0。
5. 最終只能輸出JSON。
6. 不要輸出Markdown。
7. 不要輸出<think>。
8. 不要輸出分析過程。

注意：
protein_pct、fat_pct、carb_pct、fiber_pct
代表「每100g中的克數」，不是百分比。

格式：
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

例如：
花椰菜：
{
  "food_name": "花椰菜",
  "brand": "",
  "category": "other",
  "calories_per_100g": 25,
  "protein_pct": 1.9,
  "fat_pct": 0.3,
  "carb_pct": 5,
  "fiber_pct": 2,
  "estimated_weight_g": 100
}
`
        },
        {
          role: 'user',
          content: String(foodName || '').trim()
        }
      ],
      temperature: 0.1,
      max_tokens: 300
    })

    const content = completion.choices?.[0]?.message?.content || ''

    console.log('Groq 原始營養結果:')
    console.log(content)

    const parsed = extractJsonObject(content)

    console.log('Groq JSON:', parsed)

    if (parsed) {
      const nutrition = {
        ...buildDefaultNutrition(foodName),
        ...parsed,
        food_name: parsed.food_name || foodName,
        calories_per_100g: toSafeNumber(parsed.calories_per_100g),
        protein_pct: toSafeNumber(parsed.protein_pct),
        fat_pct: toSafeNumber(parsed.fat_pct),
        carb_pct: toSafeNumber(parsed.carb_pct),
        fiber_pct: toSafeNumber(parsed.fiber_pct),
        estimated_weight_g: toSafeNumber(parsed.estimated_weight_g, 100)
      }

      /*
       * 如果 AI 有成功提供熱量，
       * 就視為有效結果。
       */
      if (nutrition.calories_per_100g > 0) {
        return nutrition
      }

      /*
       * AI 回傳 JSON 但全部是 0，
       * 代表結果無效，改用 fallback。
       */
      console.log(
        `Groq 營養資料無效，使用 fallback: ${foodName}`
      )
    }

    return getFallbackNutrition(foodName)

  } catch (err) {
    console.error('analyzeNutrition error:', err)
    return getFallbackNutrition(foodName)
  }
}

// ✅ AI 圖片辨識食物名稱
async function detectFood(req) {
  if (!req.file?.buffer) return '未知食物'

  try {
    const base64Image = req.file.buffer.toString('base64')

    const response = await gemini.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: base64Image
          }
        },
        {
          text: `
你是一個專業的食物圖片辨識模型。

請分析這張圖片中的食物。

只需要回答最可能的食物名稱。
不要輸出分析過程。
不要輸出 JSON。
不要加任何其他文字。

例如：
圖片是雞胸肉 → 雞胸肉
圖片是炒飯 → 海鮮炒飯
圖片是狗飼料 → 狗糧
圖片是貓罐頭 → 貓罐頭

如果無法判斷，回答：
未知食物
`
        }
      ]
    })

    const foodName = normalizeText(response.text || '')
      .replace(/^食物(?:名稱)?[:：\s]*/i, '')
      .replace(/^辨識結果[:：\s]*/i, '')
      .replace(/^答案[:：\s]*/i, '')
      .replace(/^[`"'「」]+|[`"'「」]+$/g, '')
      .trim()

    console.log('Gemini Food:', JSON.stringify(foodName))

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
    console.error('Gemini Vision error:', err)
    return '未知食物'
  }
}



/* ───────── 預設食物 ───────── */

const PRESET_FOODS = [
  { name: '希爾思成貓配方乾糧', category: 'dry', brand: "Hill's", calories_per_100g: 380, protein_pct: 32, fat_pct: 14, carb_pct: 40, fiber_pct: 4 },
  { name: '皇家成貓主食罐', category: 'wet', brand: 'Royal Canin', calories_per_100g: 92, protein_pct: 12, fat_pct: 5, carb_pct: 3, fiber_pct: 1 },
  { name: '希爾思成犬配方乾糧', category: 'dry', brand: "Hill's", calories_per_100g: 363, protein_pct: 20, fat_pct: 12, carb_pct: 55, fiber_pct: 3 },
  { name: '皇家成犬主食罐', category: 'wet', brand: 'Royal Canin', calories_per_100g: 85, protein_pct: 10, fat_pct: 4, carb_pct: 3, fiber_pct: 1 },
  { name: '凍乾雞肉條', category: 'snack', brand: '自然良品', calories_per_100g: 450, protein_pct: 65, fat_pct: 8, carb_pct: 5, fiber_pct: 0 },
  { name: '鮭魚貓糧', category: 'wet', brand: 'Fancy Feast', calories_per_100g: 78, protein_pct: 11, fat_pct: 4, carb_pct: 2, fiber_pct: 0 }
]

/* ───────── 路由 ───────── */

// 取得所有食物
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM food_items WHERE owner_id=$1 OR is_preset=TRUE ORDER BY is_preset DESC, name ASC',
      [req.userId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 新增自訂食物
router.post('/', async (req, res) => {
  const { name, category, brand, calories_per_100g, protein_pct, fat_pct, carb_pct, fiber_pct } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO food_items (owner_id, name, category, brand, calories_per_100g, protein_pct, fat_pct, carb_pct, fiber_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.userId, name, category || 'dry', brand || null, calories_per_100g || null,
       protein_pct || null, fat_pct || null, carb_pct || null, fiber_pct || null]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 刪除自訂食物
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM food_items WHERE id=$1 AND owner_id=$2', [req.params.id, req.userId])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// AI 文字分析營養
router.post('/ai-analyze', async (req, res) => {
  try {
    const { foodName } = req.body
    const nutrition = await analyzeNutrition(foodName)
    res.json({ success: true, data: nutrition })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: 'AI分析失敗' })
  }
})

// 初始化預設食物
router.post('/init-presets', async (req, res) => {
  try {
    for (const food of PRESET_FOODS) {
      await pool.query(
        `INSERT INTO food_items (owner_id, name, category, brand, calories_per_100g, protein_pct, fat_pct, carb_pct, fiber_pct, is_preset)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
         ON CONFLICT DO NOTHING`,
        [req.userId, food.name, food.category, food.brand, food.calories_per_100g,
         food.protein_pct, food.fat_pct, food.carb_pct, food.fiber_pct]
      )
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// AI 圖片分析食物 → 自動查營養
router.post('/ai-analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        error: '沒有圖片'
      })
    }

    const foodName = await detectFood(req)

    console.log('1. Gemini 食物名稱:', JSON.stringify(foodName))

    const nutrition = await analyzeNutrition(foodName)

    console.log('2. 營養分析結果:', nutrition)

    const normalizedResult = {
      ...nutrition,
      food_name: nutrition.food_name || foodName,
      image_food_name: foodName,
      notes: nutrition.notes || `已辨識為 ${foodName}`
    }

    console.log('3. 最終回傳前端:', normalizedResult)

    return res.json({
      success: true,
      data: normalizedResult
    })
  } catch (err) {
    console.error('ai-analyze-image error:', err)

    return res.status(500).json({
      success: false,
      error: 'AI分析失敗',
      detail: err.message
    })
  }
})

router.post('/diet-advice', async (req, res) => {
  const { pet, healthSummary } = req.body

  try {
    if (!pet) {
      return res.status(400).json({
        success: false,
        error: '缺少寵物資料'
      })
    }

    const age = pet.birth_date
      ? (() => {
          const months = Math.floor(
            (Date.now() - new Date(pet.birth_date)) /
            (1000 * 60 * 60 * 24 * 30.4)
          )

          return months < 12
            ? `${months} 個月`
            : `${Math.floor(months / 12)} 歲`
        })()
      : '年齡不明'

    const completion = await groq.chat.completions.create({
  model: DEFAULT_GROQ_MODEL,

  // 不需要推理過程
  reasoning_effort: 'none',

  // 不把 reasoning 傳回前端
  include_reasoning: false,

  messages: [
    {
      role: 'system',
      content: `
你是一位專業的寵物營養師。

你的任務是直接提供給飼主可閱讀的飲食建議。

規則：
1. 只使用繁體中文。
2. 不要輸出思考過程。
3. 不要出現 "thinking process"。
4. 不要出現 "Analyze User Input"。
5. 不要解釋推理過程。
6. 不使用 # 標題。
7. 只輸出指定的四個部分。
8. 如果寵物資料異常，在「餵食注意事項」中簡短提醒。
`
    },
    {
      role: 'user',
      content: `
寵物資料：
名稱：${pet.name}
種類：${pet.species}
品種：${pet.breed || '未知'}
年齡：${age}
體重：${pet.weight ? `${pet.weight} kg` : '未知'}

健康紀錄：
${healthSummary || '目前沒有健康諮詢紀錄'}

請直接輸出：

**每日建議熱量**
提供合理的每日熱量估算。

**建議食物種類**
說明適合的食物與應避免的食物。

**餵食注意事項**
根據寵物目前資料與健康狀況提出注意事項。

**建議補充營養素**
如果有需要，說明適合補充的營養素；如果沒有特殊需求，也請明確說明。
`
    }
  ],

  temperature: 0.2,
  max_completion_tokens: 1200
})

    const raw =
      completion.choices?.[0]?.message?.content || ''

    console.log('Diet advice raw:', raw)

    let advice = normalizeText(raw)

    // 防止模型前面又加其他廢話
    const start = advice.search(/\*\*每日建議熱量\*\*/)

    if (start >= 0) {
      advice = advice.slice(start)
    }

    if (!advice) {
      throw new Error('AI 沒有產生有效飲食建議')
    }

    return res.json({
      success: true,
      data: {
        advice: advice.trim()
      }
    })

  } catch (err) {
    console.error('diet-advice error:', err)

    return res.status(500).json({
      success: false,
      error: 'AI 飲食建議產生失敗',
      detail: err.message
    })
  }
})

module.exports = router