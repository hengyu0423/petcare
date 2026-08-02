const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')
const Groq = require('groq-sdk')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

router.use(requireAuth)

// 預設食物（系統內建）
const PRESET_FOODS = [
  { name: '希爾思成貓配方乾糧', category: 'dry', brand: "Hill's", calories_per_100g: 380, protein_pct: 32, fat_pct: 14, carb_pct: 40, fiber_pct: 4 },
  { name: '皇家成貓主食罐', category: 'wet', brand: 'Royal Canin', calories_per_100g: 92, protein_pct: 12, fat_pct: 5, carb_pct: 3, fiber_pct: 1 },
  { name: '希爾思成犬配方乾糧', category: 'dry', brand: "Hill's", calories_per_100g: 363, protein_pct: 20, fat_pct: 12, carb_pct: 55, fiber_pct: 3 },
  { name: '皇家成犬主食罐', category: 'wet', brand: 'Royal Canin', calories_per_100g: 85, protein_pct: 10, fat_pct: 4, carb_pct: 3, fiber_pct: 1 },
  { name: '凍乾雞肉條', category: 'snack', brand: '自然良品', calories_per_100g: 450, protein_pct: 65, fat_pct: 8, carb_pct: 5, fiber_pct: 0 },
  { name: '鮭魚貓糧', category: 'wet', brand: 'Fancy Feast', calories_per_100g: 78, protein_pct: 11, fat_pct: 4, carb_pct: 2, fiber_pct: 0 },
]

// 取得所有食物（預設 + 自訂）
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

// AI 分析食物營養
router.post('/ai-analyze', async (req, res) => {
  const { foodName, amount } = req.body
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: '你是一位寵物營養專家。請根據食物名稱估算營養成分，只回傳 JSON 格式，不要任何其他文字。'
        },
        {
          role: 'user',
          content: `請估算「${foodName}」每 100g 的營養成分，回傳以下 JSON 格式：
{
  "calories_per_100g": 數字,
  "protein_pct": 數字,
  "fat_pct": 數字,
  "carb_pct": 數字,
  "fiber_pct": 數字,
  "notes": "簡短說明"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
    })

    const text = completion.choices[0]?.message?.content || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const nutrition = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    res.json({ success: true, data: nutrition })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: 'AI 分析失敗' })
  }
})

// 初始化預設食物（只跑一次）
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

module.exports = router
