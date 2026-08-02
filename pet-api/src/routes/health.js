const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')

router.use(requireAuth)

router.get('/pet/:petId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM health_records WHERE pet_id=$1 ORDER BY date DESC',
      [req.params.petId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

router.post('/', async (req, res) => {
  const { petId, type, title, description, date, nextDate, clinic, cost } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO health_records (pet_id, type, title, description, date, next_date, clinic, cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [petId, type, title, description || null, date, nextDate || null, clinic || null, cost || null]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM health_records WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

module.exports = router