const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')
const multer = require('multer')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { ownsPet, getDietAlerts } = require('../services/dietInsights')
const { sanitizePreferences } = require('../services/mealPlan')
const { createNotification } = require('../services/notifications')

router.use(requireAuth)

// 圖片上傳設定
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
})

// Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// 取得某寵物的餵食紀錄
router.get('/pet/:petId', async (req, res) => {
  const { date } = req.query

  try {
    if (!(await ownsPet(req.params.petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }

    let query = 'SELECT * FROM feeding_records WHERE pet_id=$1'
    const params = [req.params.petId]

    if (date) {
      query += ' AND DATE(fed_at) = $2'
      params.push(date)
    }

    query += ' ORDER BY fed_at DESC'

    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '伺服器錯誤'
    })
  }
})

// 取得每日統計
router.get('/pet/:petId/daily-stats', async (req, res) => {
  try {
    if (!(await ownsPet(req.params.petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }

    const result = await pool.query(
      `SELECT
        DATE(fed_at) as date,
        SUM(calories) as total_calories,
        SUM(protein_g) as total_protein,
        SUM(fat_g) as total_fat,
        SUM(carb_g) as total_carb,
        COUNT(*) as meal_count
       FROM feeding_records
       WHERE pet_id=$1
       AND fed_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(fed_at)
       ORDER BY date DESC`,
      [req.params.petId]
    )

    res.json({
      success: true,
      data: result.rows
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '伺服器錯誤'
    })
  }
})

// ================================
// 飲食異常警訊
// GET /feeding/pet/:petId/diet-alerts
//
// 依最近 7 天的餵食紀錄（使用已儲存的 calories / protein_g /
// fat_g / carb_g）分析食物集中、熱量與營養比例。
// 只回傳「提醒／建議」，不做醫療判斷。
// ================================
router.get('/pet/:petId/diet-alerts', async (req, res) => {
  try {
    if (!(await ownsPet(req.params.petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }

    const result = await getDietAlerts(req.params.petId)

    res.json({
      success: true,
      data: result || { alerts: [], basis: null }
    })
  } catch (err) {
    console.error('飲食異常分析失敗：', err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// ================================
// 飼主的飲食偏好（供「今日飲食計畫」與餵食檢查使用）
// GET / PUT /feeding/pet/:petId/diet-preferences
// 存在 pets.diet_preferences
// ================================
router.get('/pet/:petId/diet-preferences', async (req, res) => {
  try {
    if (!(await ownsPet(req.params.petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }

    const result = await pool.query(
      'SELECT diet_preferences FROM pets WHERE id = $1',
      [req.params.petId]
    )

    res.json({
      success: true,
      data: sanitizePreferences(result.rows[0]?.diet_preferences)
    })
  } catch (err) {
    console.error('讀取飲食偏好失敗：', err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

router.put('/pet/:petId/diet-preferences', async (req, res) => {
  try {
    const prefs = sanitizePreferences(req.body)

    const result = await pool.query(
      `UPDATE pets
       SET diet_preferences = $2::jsonb
       WHERE id = $1 AND owner_id = $3
       RETURNING diet_preferences`,
      [req.params.petId, JSON.stringify(prefs), req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }

    res.json({
      success: true,
      data: sanitizePreferences(result.rows[0].diet_preferences)
    })
  } catch (err) {
    console.error('儲存飲食偏好失敗：', err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// ================================
// 圖片辨識食物 + 熱量估算
// ================================
router.post('/ai-analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '請上傳食物圖片'
      })
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash'
    })

    const prompt = `
你是一個寵物食物營養分析 AI。

請分析這張食物圖片，判斷這是什麼食物，以及估算適合寵物食用的營養資訊。

請只回傳 JSON，不要 Markdown，不要其他文字。

格式：

{
  "foodName": "食物名稱",
  "estimatedAmountG": 100,
  "calories": 150,
  "proteinG": 20,
  "fatG": 5,
  "carbG": 10,
  "confidence": 0.85,
  "note": "簡短說明"
}

規則：
1. foodName 使用繁體中文。
2. estimatedAmountG 是圖片中可見食物的估計重量，單位為克。
3. calories 是估計總熱量，單位 kcal。
4. proteinG、fatG、carbG 是估計總營養素重量，單位 g。
5. 如果無法確定食物，foodName 填「無法辨識」。
6. 如果無法合理估計份量，estimatedAmountG 填 null。
7. confidence 為 0~1。
8. 不要假裝精確，圖片估算只能提供約略數值。
`

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    }

    const result = await model.generateContent([
      prompt,
      imagePart
    ])

    const text = result.response.text()

    // 清理 Gemini 可能產生的 ```json
    const cleanText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    const data = JSON.parse(cleanText)

    res.json({
      success: true,
      data
    })

  } catch (err) {
    console.error('Food image AI error:', err)

    res.status(500).json({
      success: false,
      error: '圖片分析失敗'
    })
  }
})

// 新增餵食紀錄
router.post('/', async (req, res) => {
  const {
    petId,
    foodItemId,
    foodName,
    amountG,
    calories,
    proteinG,
    fatG,
    carbG,
    fedAt,
    notes
  } = req.body

  try {
    if (!(await ownsPet(petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }

    const result = await pool.query(
      `INSERT INTO feeding_records
       (pet_id, food_item_id, food_name, amount_g, calories,
        protein_g, fat_g, carb_g, fed_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        petId,
        foodItemId || null,
        foodName,
        amountG,
        calories || null,
        proteinG || null,
        fatG || null,
        carbG || null,
        fedAt || new Date().toISOString(),
        notes || null
      ]
    )

    // 有 warning 等級的飲食異常提醒才通知（同一種提醒 24 小時內只會有一筆，
    // 見 services/notifications.js 的防洗版邏輯），失敗不影響餵食紀錄本身
    try {
      const insight = await getDietAlerts(petId)
      const top = insight?.alerts?.find(a => a.level === 'warning')

      if (top) {
        await createNotification({
          petId,
          type: 'feeding_reminder',
          title: `飲食提醒：${top.title}`,
          message: top.suggestion || top.message,
          severity: 'info',
          metadata: { alertId: top.id }
        })
      }
    } catch (notifyErr) {
      console.warn('⚠️ 飲食提醒通知建立失敗，略過：', notifyErr.message)
    }

    res.json({
      success: true,
      data: result.rows[0]
    })

  } catch (err) {
    console.error(err)

    res.status(500).json({
      success: false,
      error: '伺服器錯誤'
    })
  }
})

// 刪除餵食紀錄
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM feeding_records
       WHERE id=$1
         AND pet_id IN (SELECT id FROM pets WHERE owner_id=$2)`,
      [req.params.id, req.userId]
    )

    res.json({
      success: true
    })

  } catch (err) {
    res.status(500).json({
      success: false,
      error: '伺服器錯誤'
    })
  }
})

module.exports = router