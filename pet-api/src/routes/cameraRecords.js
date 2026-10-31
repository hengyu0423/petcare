const router = require('express').Router()
const pool = require('../db')
const jwt = require('jsonwebtoken')

// 從 Authorization Header 或查詢字串解析登入的使用者 ID
function resolveUserId(req) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(
        authHeader.slice(7),
        process.env.JWT_SECRET || 'secret'
      )
      if (decoded?.userId) return decoded.userId
    } catch {}
  }
  return req.body?.userId || req.query?.userId || null
}

// ======================================================
// 1. 新增攝影機行為與偵測紀錄
// POST /api/camera-records
// （供 pet cam / main.py 定時呼叫，不需登入 token，依 userId + cameraId 管理）
// ======================================================
router.post('/', async (req, res) => {
  let {
    userId,
    cameraId = 'cam_1',
    detectedType = 'pet',
    mood,
    behavior,
    confidence,
    aspectRatio,
    movement
  } = req.body

  if (!mood) {
    return res.status(400).json({ success: false, error: '缺少 mood 狀態資料' })
  }

  try {
    // 若未指定 userId，自動關聯到系統第一個使用者帳號
    if (!userId) {
      const userRes = await pool.query('SELECT id FROM users ORDER BY id ASC LIMIT 1')
      userId = userRes.rows[0]?.id
    }

    if (!userId) {
      return res.status(400).json({ success: false, error: '系統中尚無使用者帳號' })
    }

    // 寫入攝影機專屬歷史表
    const result = await pool.query(`
      INSERT INTO camera_records
        (user_id, camera_id, detected_type, mood, behavior, confidence, aspect_ratio, movement)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId,
      cameraId,
      detectedType,
      mood,
      behavior || null,
      confidence ?? null,
      aspectRatio ?? null,
      movement ?? null
    ])

    // 同步寬容寫入既有 pet_mood_records 表（pet_id 為 null），確保舊版元件查詢兼容
    try {
      await pool.query(`
        INSERT INTO pet_mood_records
          (pet_id, user_id, camera_id, detected_type, mood, behavior, confidence, aspect_ratio, movement)
        VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        userId,
        cameraId,
        detectedType,
        mood,
        behavior || null,
        confidence ?? null,
        aspectRatio ?? null,
        movement ?? null
      ])
    } catch (compatErr) {
      // 容錯忽略兼容表報錯
    }

    console.log(`📷 [Camera ${cameraId}] 已記錄狀態：${mood} (${behavior || '無'}) | User: ${userId}`)

    res.status(201).json({
      success: true,
      record: result.rows[0]
    })
  } catch (err) {
    console.error('儲存攝影機紀錄失敗：', err)
    res.status(500).json({ success: false, error: '無法儲存攝影機紀錄' })
  }
})

// ======================================================
// 2. 攝影機近期狀態摘要（首頁 / 攝影機頁使用）
// GET /api/camera-records/summary?cameraId=cam_1&minutes=10
// （以攝影機為單位，所有登入使用者皆可查看）
// ======================================================
router.get('/summary', async (req, res) => {
  const cameraId = req.query.cameraId || 'cam_1'
  const minutes = Math.min(Math.max(Number(req.query.minutes) || 10, 1), 1440)

  try {
    const result = await pool.query(`
      SELECT mood, behavior, detected_type AS "detectedType", recorded_at AS "recordedAt"
      FROM camera_records
      WHERE camera_id = $1
        AND recorded_at >= NOW() - ($2 * INTERVAL '1 minute')
      ORDER BY recorded_at ASC
    `, [cameraId, minutes])

    const records = result.rows

    if (records.length === 0) {
      return res.json({
        success: false,
        cameraId,
        minutes,
        samples: 0,
        message: `攝影機在最近 ${minutes} 分鐘內沒有辨識紀錄`
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
      cameraId,
      minutes,
      mainMood,
      percentage,
      latestBehavior: latest.behavior,
      detectedType: latest.detectedType,
      samples: records.length,
      updatedAt: latest.recordedAt
    })
  } catch (err) {
    console.error('取得攝影機狀態摘要失敗：', err)
    res.status(500).json({ success: false, error: '無法取得攝影機狀態摘要' })
  }
})

// ======================================================
// 3. 攝影機今日所有紀錄
// GET /api/camera-records/today?cameraId=cam_1
// （以攝影機為單位，所有登入使用者皆可查看）
// ======================================================
router.get('/today', async (req, res) => {
  const cameraId = req.query.cameraId || 'cam_1'

  try {
    const result = await pool.query(`
      SELECT
        id,
        user_id AS "userId",
        camera_id AS "cameraId",
        detected_type AS "detectedType",
        mood,
        behavior,
        confidence,
        aspect_ratio AS "aspectRatio",
        movement,
        recorded_at AS "recordedAt"
      FROM camera_records
      WHERE camera_id = $1
        AND (recorded_at AT TIME ZONE 'Asia/Taipei')::date =
            (NOW() AT TIME ZONE 'Asia/Taipei')::date
      ORDER BY recorded_at ASC
    `, [cameraId])

    res.json({
      success: true,
      cameraId,
      count: result.rows.length,
      records: result.rows
    })
  } catch (err) {
    console.error('取得攝影機今日紀錄失敗：', err)
    res.status(500).json({ success: false, error: '無法取得攝影機今日紀錄' })
  }
})

// ======================================================
// 4. 攝影機最近 N 分鐘紀錄
// GET /api/camera-records?cameraId=cam_1&minutes=20
// （以攝影機為單位，所有登入使用者皆可查看）
// ======================================================
router.get('/', async (req, res) => {
  const cameraId = req.query.cameraId || 'cam_1'
  const minutes = Math.min(Math.max(Number(req.query.minutes) || 20, 1), 1440)

  try {
    const result = await pool.query(`
      SELECT
        id,
        user_id AS "userId",
        camera_id AS "cameraId",
        detected_type AS "detectedType",
        mood,
        behavior,
        confidence,
        aspect_ratio AS "aspectRatio",
        movement,
        recorded_at AS "recordedAt"
      FROM camera_records
      WHERE camera_id = $1
        AND recorded_at >= NOW() - ($2 * INTERVAL '1 minute')
      ORDER BY recorded_at ASC
    `, [cameraId, minutes])

    res.json({
      success: true,
      cameraId,
      minutes,
      count: result.rows.length,
      records: result.rows
    })
  } catch (err) {
    console.error('取得攝影機紀錄失敗：', err)
    res.status(500).json({ success: false, error: '無法取得攝影機紀錄' })
  }
})

module.exports = router
