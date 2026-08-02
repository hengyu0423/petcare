const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')

router.use(requireAuth)

// 取得某寵物的餵食紀錄
router.get('/pet/:petId', async (req, res) => {
  const { date } = req.query
  try {
    let query = 'SELECT * FROM feeding_records WHERE pet_id=$1'
    const params = [req.params.petId]
    if (date) {
      query += ' AND DATE(fed_at) = $2'
      params.push(date)
    }
    query += ' ORDER BY fed_at DESC'
    const result = await pool.query(query, params)
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 取得每日統計
router.get('/pet/:petId/daily-stats', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        DATE(fed_at) as date,
        SUM(calories) as total_calories,
        SUM(protein_g) as total_protein,
        SUM(fat_g) as total_fat,
        SUM(carb_g) as total_carb,
        COUNT(*) as meal_count
       FROM feeding_records
       WHERE pet_id=$1 AND fed_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(fed_at)
       ORDER BY date DESC`,
      [req.params.petId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 新增餵食紀錄
router.post('/', async (req, res) => {
  const { petId, foodItemId, foodName, amountG, calories, proteinG, fatG, carbG, fedAt, notes } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO feeding_records (pet_id, food_item_id, food_name, amount_g, calories, protein_g, fat_g, carb_g, fed_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [petId, foodItemId || null, foodName, amountG, calories || null,
       proteinG || null, fatG || null, carbG || null, fedAt || new Date().toISOString(), notes || null]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 刪除餵食紀錄
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM feeding_records WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

module.exports = router