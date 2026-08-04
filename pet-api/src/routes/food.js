const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')
const Groq = require('groq-sdk')
const multer = require('multer')

const path = require('path')
const vision = require('@google-cloud/vision')

const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, '../../google-service-account.json')
})

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const upload = multer({ storage: multer.memoryStorage() })

router.use(requireAuth)
console.log(
  path.join(__dirname, '../google-service-account.json')
)
// ✅ 文字分析用的模型
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.6-27b'

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
  const normalizedName = String(foodName || '').toLowerCase()

  if (normalizedName.includes('鮭魚') || normalizedName.includes('salmon')) {
    return { ...buildDefaultNutrition(foodName), calories_per_100g: 208, protein_pct: 20, fat_pct: 12, carb_pct: 0, fiber_pct: 0 }
  }
  if (normalizedName.includes('雞胸') || normalizedName.includes('雞肉') || normalizedName.includes('chicken')) {
    return { ...buildDefaultNutrition(foodName), calories_per_100g: 165, protein_pct: 31, fat_pct: 3.6, carb_pct: 0, fiber_pct: 0 }
  }
  if (normalizedName.includes('牛肉') || normalizedName.includes('beef')) {
    return { ...buildDefaultNutrition(foodName), calories_per_100g: 250, protein_pct: 26, fat_pct: 15, carb_pct: 0, fiber_pct: 0 }
  }
  if (normalizedName.includes('罐頭') || normalizedName.includes('wet') || normalizedName.includes('濕')) {
    return { ...buildDefaultNutrition(foodName), calories_per_100g: 90, protein_pct: 10, fat_pct: 4, carb_pct: 3, fiber_pct: 1 }
  }
  if (normalizedName.includes('乾糧') || normalizedName.includes('dry') || normalizedName.includes('飼料') || normalizedName.includes('糧')) {
    return { ...buildDefaultNutrition(foodName), calories_per_100g: 360, protein_pct: 25, fat_pct: 12, carb_pct: 40, fiber_pct: 3 }
  }
  return buildDefaultNutrition(foodName)
}

/* ───────── AI 核心功能 ───────── */

// 根據食物名稱分析營養成分
async function analyzeNutrition(foodName) {
  if (!process.env.GROQ_API_KEY) {
    return buildDefaultNutrition(foodName)
  }

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: `
你是寵物營養專家。
根據食物名稱估算每100g營養。
只能回傳JSON，不要思考過程。
{
  "food_name":"",
  "brand":"",
  "category":"other",
  "calories_per_100g":0,
  "protein_pct":0,
  "fat_pct":0,
  "carb_pct":0,
  "fiber_pct":0,
  "estimated_weight_g":100
}
`
        },
        { role: 'user', content: foodName }
      ],
      temperature: 0.2,
      max_tokens: 300
    })

    const content = completion.choices?.[0]?.message?.content || '{}'
    const parsed = extractJsonObject(content)

    if (parsed) {
      const nutrition = {
        ...buildDefaultNutrition(foodName),
        ...parsed,
        calories_per_100g: toSafeNumber(parsed.calories_per_100g),
        protein_pct: toSafeNumber(parsed.protein_pct),
        fat_pct: toSafeNumber(parsed.fat_pct),
        carb_pct: toSafeNumber(parsed.carb_pct),
        fiber_pct: toSafeNumber(parsed.fiber_pct),
        estimated_weight_g: toSafeNumber(parsed.estimated_weight_g, 100)
      }

      if (nutrition.calories_per_100g > 0) {
        return nutrition
      }
    }

    return getFallbackNutrition(foodName)
  } catch (err) {
    console.error('analyzeNutrition error:', err)
    return getFallbackNutrition(foodName)
  }
}

// ✅ AI 圖片辨識食物名稱
async function detectFood(req) {

  if (!req.file?.buffer) {
    return "未知食物"
  }

  try {

    const [result] = await visionClient.annotateImage({

      image: {
        content: req.file.buffer
      },

      features: [
        {
          type: "LABEL_DETECTION",
          maxResults: 10
        },
        {
          type: "OBJECT_LOCALIZATION",
          maxResults: 10
        }
      ]

    })

    const labels =
      result.labelAnnotations?.map(x => x.description) || []

    const objects =
      result.localizedObjectAnnotations?.map(x => x.name) || []

    console.log("Vision Labels:", labels)

    console.log("Vision Objects:", objects)

    const foodName = mapVisionLabels(labels, objects)

    console.log("Food:", foodName)

    return foodName

  } catch (err) {

    console.error("Google Vision error:", err)

    return "未知食物"

  }

}

function mapVisionLabels(labels, objects) {
  const all = [
    ...labels,
    ...objects
  ].map(x => x.toLowerCase())

  console.log("All Vision Results:", all)

  // ===== 魚類 =====
  if (all.includes("salmon")) return "鮭魚"
  if (all.includes("tuna")) return "鮪魚"
  if (all.includes("fish")) return "魚肉"
  if (all.includes("seafood")) return "海鮮"

  // ===== 肉類 =====
  if (all.includes("chicken")) return "雞胸肉"
  if (all.includes("beef")) return "牛肉"
  if (all.includes("pork")) return "豬肉"
  if (all.includes("meat")) return "肉類"

  // ===== 蛋 =====
  if (all.includes("egg")) return "雞蛋"

  // ===== 飯 =====
  if (all.includes("rice")) return "白飯"

  // ===== 寵物食品 =====
  if (all.includes("cat food")) return "貓糧"
  if (all.includes("dog food")) return "狗糧"
  if (all.includes("pet food")) return "寵物食品"

  return "未知食物"
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
      return res.status(400).json({ success: false, error: '沒有圖片' })
    }

    const foodName = await detectFood(req)
    const nutrition = await analyzeNutrition(foodName)

    const normalizedResult = {
      ...nutrition,
      food_name: nutrition.food_name || foodName,
      image_food_name: foodName,
      notes: nutrition.notes || `已辨識為 ${foodName}`
    }

    return res.json({ success: true, data: normalizedResult })
  } catch (err) {
    console.error('ai-analyze-image error:', err)
    return res.status(500).json({
      success: false,
      error: 'AI分析失敗',
      detail: err.message
    })
  }
})

module.exports = router