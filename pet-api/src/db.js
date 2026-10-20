const { Pool, types } = require('pg')

// DATE 欄位（生日、量體重日期…）直接回傳 'YYYY-MM-DD' 字串，不轉成 JS Date。
// 否則 pg 會轉成「伺服器時區的午夜」，在 UTC+8 的電腦上 res.json 後會變成
// 前一天的 16:00Z，前端 slice(0, 10) 就少一天，年齡／生日倒數會差一天。
types.setTypeParser(1082, value => value)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

module.exports = pool