const express = require('express')
const router = express.Router()

// 取得本地日期字串 (YYYY-MM-DD)，確保台灣時間午夜 00:00 準時重置
function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

let cam2Stats = {
  date: getTodayDate(),
  catCount: 0,
  isPresent: false,
  lastSeen: null,
}

function resetIfNewDay() {
  const today = getTodayDate()
  if (cam2Stats.date !== today) {
    cam2Stats = {
      date: today,
      catCount: 0,
      isPresent: false,
      lastSeen: null,
    }
  }
}

// POST /api/cat-count（接收 pet-camtwo.py 傳來的最新次數）
router.post('/', (req, res) => {
  resetIfNewDay()
  const { catCount, isPresent, timestamp, date } = req.body
  cam2Stats = {
    date: date || getTodayDate(),
    catCount: catCount ?? cam2Stats.catCount,
    isPresent: isPresent ?? cam2Stats.isPresent,
    lastSeen: timestamp || new Date().toLocaleTimeString(),
  }
  res.json({ success: true, data: cam2Stats })
})

// GET /api/cat-count（提供給前端與 Python 啟動時查詢今日次數）
router.get('/', (req, res) => {
  resetIfNewDay()
  res.json(cam2Stats)
})

module.exports = router