const express = require('express')
const cors = require('cors')
require('dotenv').config()

const pool = require('./db')
const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json())

// 自動建立資料表
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pets (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      species VARCHAR(50) NOT NULL,
      breed VARCHAR(100),
      gender VARCHAR(20) DEFAULT 'unknown',
      birth_date DATE,
      weight DECIMAL(5,2),
      avatar TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS health_records (
      id SERIAL PRIMARY KEY,
      pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      next_date DATE,
      clinic VARCHAR(200),
      cost DECIMAL(10,2),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS food_items (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(50) DEFAULT 'dry',
      brand VARCHAR(100),
      calories_per_100g DECIMAL(8,2),
      protein_pct DECIMAL(5,2),
      fat_pct DECIMAL(5,2),
      carb_pct DECIMAL(5,2),
      fiber_pct DECIMAL(5,2),
      is_preset BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS feeding_records (
      id SERIAL PRIMARY KEY,
      pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
      food_item_id INTEGER REFERENCES food_items(id) ON DELETE SET NULL,
      food_name VARCHAR(200) NOT NULL,
      amount_g DECIMAL(8,2) NOT NULL,
      calories DECIMAL(8,2),
      protein_g DECIMAL(8,2),
      fat_g DECIMAL(8,2),
      carb_g DECIMAL(8,2),
      fed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS health_consultations (
      id SERIAL PRIMARY KEY,
      pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
      role VARCHAR(10) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `)
  console.log('✅ 資料表準備完成')
}

initDB().catch(console.error)

app.use('/api/auth',           require('./routes/auth'))
app.use('/api/pets',           require('./routes/pets'))
app.use('/api/health-records', require('./routes/health'))
app.use('/api/expenses', require('./routes/expenses'))
app.use('/api/ai', require('./routes/ai'))
app.use('/api/food', require('./routes/food'))
app.use('/api/feeding', require('./routes/feeding'))
app.use('/api/consultations', require('./routes/consultations'))

app.get('/api/ping', async (_req, res) => {
  const result = await pool.query('SELECT NOW()')
  res.json({ ok: true, time: result.rows[0].now })
})

app.listen(PORT, () => console.log(`🐾 API running on http://localhost:${PORT}`))