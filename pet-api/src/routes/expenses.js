const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')

router.use(requireAuth)

// 這隻寵物是不是目前登入的使用者的（id 不是數字也視為不是）
async function ownsPet(petId, userId) {
  if (!/^\d+$/.test(String(petId))) return false
  const r = await pool.query('SELECT 1 FROM pets WHERE id=$1 AND owner_id=$2', [petId, userId])
  return r.rows.length > 0
}

// 取得某寵物所有支出
router.get('/pet/:petId', async (req, res) => {
  try {
    if (!(await ownsPet(req.params.petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }
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
    if (!(await ownsPet(petId, req.userId))) {
      return res.status(404).json({ success: false, error: '找不到寵物' })
    }
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
    // 只能刪自己寵物的支出
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(404).json({ success: false, error: '找不到這筆支出' })
    }
    const result = await pool.query(
      `DELETE FROM expenses e
        USING pets p
        WHERE e.id = $1 AND e.pet_id = p.id AND p.owner_id = $2
        RETURNING e.id`,
      [req.params.id, req.userId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到這筆支出' })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

module.exports = router