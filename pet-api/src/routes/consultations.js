const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')

router.use(requireAuth)

// 取得某寵物的對話紀錄
router.get('/pet/:petId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM health_consultations WHERE pet_id=$1 ORDER BY created_at ASC',
      [req.params.petId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 新增對話訊息
router.post('/', async (req, res) => {
  const { petId, role, content } = req.body
  try {
    const result = await pool.query(
      'INSERT INTO health_consultations (pet_id, role, content) VALUES ($1,$2,$3) RETURNING *',
      [petId, role, content]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 清除某寵物的對話紀錄
router.delete('/pet/:petId', async (req, res) => {
  try {
    await pool.query('DELETE FROM health_consultations WHERE pet_id=$1', [req.params.petId])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

module.exports = router