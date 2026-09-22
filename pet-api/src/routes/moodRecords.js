const router = require('express').Router()
const pool = require('../db')

// 新增行為紀錄
// POST /api/mood-records
router.post('/', async (req, res) => {
  const { petId, mood, behavior, confidence, aspectRatio, movement } = req.body

  if (!petId || !mood) {
    return res.status(400).json({ success: false, error: '缺少 petId 或 mood' })
  }

  try {
    const result = await pool.query(`
      INSERT INTO pet_mood_records
        (pet_id, mood, behavior, confidence, aspect_ratio, movement)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      petId,
      mood,
      behavior || null,
      confidence ?? null,
      aspectRatio ?? null,
      movement ?? null
    ])

    console.log(`🐱 已儲存狀態：${mood} | pet: ${petId}`)

    res.status(201).json({
      success: true,
      record: result.rows[0]
    })
  } catch (err) {
    console.error('儲存行為紀錄失敗：', err)
    res.status(500).json({ success: false, error: '無法儲存行為紀錄' })
  }
})

// 首頁近期狀態摘要
// GET /api/mood-records/pet/:petId/summary?minutes=10
router.get('/pet/:petId/summary', async (req, res) => {
  const petId = Number(req.params.petId)
  const minutes = Math.min(Math.max(Number(req.query.minutes) || 10, 1), 1440)

  if (!Number.isInteger(petId)) {
    return res.status(400).json({ success: false, error: 'petId 格式錯誤' })
  }

  try {
    const result = await pool.query(`
      SELECT mood, behavior, recorded_at AS "recordedAt"
      FROM pet_mood_records
      WHERE pet_id = $1
        AND recorded_at >= NOW() - ($2 * INTERVAL '1 minute')
      ORDER BY recorded_at ASC
    `, [petId, minutes])

    const records = result.rows

    if (records.length === 0) {
      return res.json({
        success: false,
        minutes,
        samples: 0,
        message: `最近 ${minutes} 分鐘沒有辨識紀錄`
      })
    }

    const moodCounts = {}
    records.forEach(item => {
      moodCounts[item.mood] = (moodCounts[item.mood] || 0) + 1
    })

    const [mainMood, count] = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])[0]

    const percentage = Math.round((count / records.length) * 100)
    const latest = records[records.length - 1]

    res.json({
      success: true,
      minutes,
      mainMood,
      percentage,
      samples: records.length,
      updatedAt: latest.recordedAt
    })
  } catch (err) {
    console.error('取得近期狀態摘要失敗：', err)
    res.status(500).json({ success: false, error: '無法取得近期狀態摘要' })
  }
})

// 今天的紀錄
// GET /api/mood-records/pet/:petId/today
router.get('/pet/:petId/today', async (req, res) => {
  const petId = Number(req.params.petId)

  if (!Number.isInteger(petId)) {
    return res.status(400).json({ success: false, error: 'petId 格式錯誤' })
  }

  try {
    const result = await pool.query(`
      SELECT
        id,
        pet_id AS "petId",
        mood,
        behavior,
        confidence,
        aspect_ratio AS "aspectRatio",
        movement,
        recorded_at AS "recordedAt"
      FROM pet_mood_records
      WHERE pet_id = $1
        AND (recorded_at AT TIME ZONE 'Asia/Taipei')::date =
            (NOW() AT TIME ZONE 'Asia/Taipei')::date
      ORDER BY recorded_at ASC
    `, [petId])

    res.json({
      success: true,
      count: result.rows.length,
      records: result.rows
    })
  } catch (err) {
    console.error('取得今日紀錄失敗：', err)
    res.status(500).json({ success: false, error: '無法取得今日紀錄' })
  }
})

// 最近 N 分鐘
// GET /api/mood-records/pet/:petId?minutes=20
router.get('/pet/:petId', async (req, res) => {
  const petId = Number(req.params.petId)
  const minutes = Math.min(Math.max(Number(req.query.minutes) || 20, 1), 1440)

  if (!Number.isInteger(petId)) {
    return res.status(400).json({ success: false, error: 'petId 格式錯誤' })
  }

  try {
    const result = await pool.query(`
      SELECT
        id,
        pet_id AS "petId",
        mood,
        behavior,
        confidence,
        aspect_ratio AS "aspectRatio",
        movement,
        recorded_at AS "recordedAt"
      FROM pet_mood_records
      WHERE pet_id = $1
        AND recorded_at >= NOW() - ($2 * INTERVAL '1 minute')
      ORDER BY recorded_at ASC
    `, [petId, minutes])

    res.json({
      success: true,
      minutes,
      count: result.rows.length,
      records: result.rows
    })
  } catch (err) {
    console.error('取得行為紀錄失敗：', err)
    res.status(500).json({ success: false, error: '無法取得行為紀錄' })
  }
})

module.exports = router