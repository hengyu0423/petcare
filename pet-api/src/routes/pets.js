const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')

router.use(requireAuth)

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM pets WHERE owner_id = $1 ORDER BY created_at DESC',
      [req.userId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

router.post('/', async (req, res) => {
  const { name, species, breed, gender, birthDate, weight, notes } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO pets (owner_id, name, species, breed, gender, birth_date, weight, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [req.userId, name, species, breed || null, gender || 'unknown', birthDate || null, weight || null, notes || null]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

router.put('/:id', async (req, res) => {
  const { name, species, breed, gender, birthDate, weight, notes } = req.body
  try {
    const result = await pool.query(
      `UPDATE pets SET name=$1, species=$2, breed=$3, gender=$4,
       birth_date=$5, weight=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 AND owner_id=$9 RETURNING *`,
      [name, species, breed || null, gender || 'unknown', birthDate || null, weight || null, notes || null, req.params.id, req.userId]
    )
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: '找不到寵物' })
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM pets WHERE id=$1 AND owner_id=$2 RETURNING id',
      [req.params.id, req.userId]
    )
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: '找不到寵物' })
    res.json({ success: true, message: '已刪除' })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

module.exports = router