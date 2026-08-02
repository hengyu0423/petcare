const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')

router.use(requireAuth)

// 取得某寵物所有支出
router.get('/pet/:petId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM expenses WHERE pet_id=$1 ORDER BY date DESC',
      [req.params.petId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 取得用戶所有寵物的支出統計
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        p.id as pet_id, p.name as pet_name, p.species,
        e.category,
        SUM(e.amount) as total,
        COUNT(*) as count
       FROM expenses e
       JOIN pets p ON e.pet_id = p.id
       WHERE p.owner_id = $1
       GROUP BY p.id, p.name, p.species, e.category
       ORDER BY p.name, e.category`,
      [req.userId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 月度統計
router.get('/monthly', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        p.name as pet_name,
        p.id as pet_id,
        SUM(amount) as total
       FROM expenses e
       JOIN pets p ON e.pet_id = p.id
       WHERE p.owner_id = $1
       GROUP BY month, p.id, p.name
       ORDER BY month DESC`,
      [req.userId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 新增支出
router.post('/', async (req, res) => {
  const { petId, category, title, amount, date, notes } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO expenses (pet_id, category, title, amount, date, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [petId, category, title, amount, date, notes || null]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 刪除支出
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

module.exports = router