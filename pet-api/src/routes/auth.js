const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db')

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (exists.rows.length > 0)
      return res.status(400).json({ success: false, error: 'Email 已被使用' })

    const hashed = await bcrypt.hash(password, 10)
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hashed]
    )
    const user = result.rows[0]
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
    res.json({ success: true, data: { user, token } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = result.rows[0]
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ success: false, error: 'Email 或密碼錯誤' })

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
    const { password: _, ...safeUser } = user
    res.json({ success: true, data: { user: safeUser, token } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

module.exports = router