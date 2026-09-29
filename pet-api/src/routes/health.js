const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')

router.use(requireAuth)

const VALID_SEVERITY = ['normal', 'urgent', 'emergency']

// 確認這隻寵物屬於目前登入的使用者
async function ownsPet(petId, userId) {
  const result = await pool.query(
    'SELECT id FROM pets WHERE id=$1 AND owner_id=$2',
    [petId, userId]
  )
  return result.rows.length > 0
}

// ------------------------------------------------------
// 取得某寵物所有健康紀錄（包含手動與 AI 自動記錄）
// GET /health-records/pet/:petId
// ------------------------------------------------------
router.get('/pet/:petId', async (req, res) => {
  try {
    if (!(await ownsPet(req.params.petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }

    const result = await pool.query(
      'SELECT * FROM health_records WHERE pet_id=$1 ORDER BY date DESC, id DESC',
      [req.params.petId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// ------------------------------------------------------
// ⭐ 取得某寵物「近期與飲食有關」的重要健康紀錄
// GET /health-records/pet/:petId/diet-relevant?days=14
//
// 回傳條件：diet_relevant = true，且
//   (a) 事件日期在最近 N 天內，或
//   (b) 飲食注意事項尚未到期（diet_until >= 今天）
//
// 每筆多一個 is_active 欄位：注意事項目前是否仍有效
// ------------------------------------------------------
router.get('/pet/:petId/diet-relevant', async (req, res) => {
  try {
    if (!(await ownsPet(req.params.petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }

    const days = Math.min(
      Math.max(parseInt(req.query.days, 10) || 14, 1),
      90
    )
    const tz = process.env.APP_TIMEZONE || 'Asia/Taipei'

    const result = await pool.query(
      `
      SELECT
        *,
        -- DATE 欄位直接輸出字串，避免伺服器時區造成日期差一天
        to_char(date, 'YYYY-MM-DD') AS date_str,
        to_char(diet_until, 'YYYY-MM-DD') AS diet_until_str,
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
      [req.params.petId, days, tz]
    )

    res.json({ success: true, data: result.rows })
  } catch (err) {
    console.error('取得飲食相關健康紀錄失敗：', err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// ------------------------------------------------------
// 新增健康紀錄（手動）
// POST /health-records
// 新增的欄位皆為選填，舊的呼叫方式不受影響
// ------------------------------------------------------
router.post('/', async (req, res) => {
  const {
    petId,
    type,
    title,
    description,
    date,
    nextDate,
    clinic,
    cost,
    severity,
    dietRelevant,
    dietNotes,
    avoidFoods,
    dietUntil
  } = req.body

  try {
    if (!(await ownsPet(petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }

    const dietInfo = {}
    if (dietNotes) dietInfo.dietNotes = String(dietNotes)
    if (Array.isArray(avoidFoods)) dietInfo.avoidFoods = avoidFoods.map(String)

    const result = await pool.query(
      `INSERT INTO health_records
         (pet_id, type, title, description, date, next_date, clinic, cost,
          source, severity, diet_relevant, diet_info, diet_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'manual',$9,$10,$11::jsonb,$12)
       RETURNING *`,
      [
        petId,
        type,
        title,
        description || null,
        date,
        nextDate || null,
        clinic || null,
        cost || null,
        VALID_SEVERITY.includes(severity) ? severity : null,
        Boolean(dietRelevant),
        JSON.stringify(dietInfo),
        dietUntil || null
      ]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// ------------------------------------------------------
// 刪除健康紀錄（只能刪除自己寵物的紀錄）
// DELETE /health-records/:id
// ------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM health_records
       WHERE id=$1
         AND pet_id IN (SELECT id FROM pets WHERE owner_id=$2)`,
      [req.params.id, req.userId]
    )
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

module.exports = router