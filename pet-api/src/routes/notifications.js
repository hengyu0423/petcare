const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const pool = require('../db')
const requireAuth = require('../middleware/auth')
const { ownsPet } = require('../services/dietInsights')

const {
  createNotification,
  getPreferences,
  savePreferences,
  subscribe,
  unsubscribe
} = require('../services/notifications')

// ------------------------------------------------------
// 新增通知
//
// 這一個端點故意不套 requireAuth：攝影機服務（pet cam/main.py）
// 是伺服器對伺服器呼叫，沒有登入 token，只認得 petId。
// 實際的使用者判斷、通知偏好、防洗版都交給 createNotification()。
// ------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const {
      petId,
      type,
      title,
      message,
      severity = 'info',
      metadata = {}
    } = req.body

    if (!petId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: '缺少必要資料'
      })
    }

    const result = await createNotification({
      petId,
      type,
      title,
      message,
      severity,
      metadata
    })

    if (result.skipped === 'no_owner') {
      return res.status(404).json({
        success: false,
        message: '找不到寵物或此寵物沒有對應的使用者'
      })
    }

    // 飼主關閉了這種通知類型：視為成功處理，只是沒有建立通知
    if (result.skipped === 'muted') {
      return res.status(200).json({
        success: true,
        skipped: 'muted'
      })
    }

    res.status(201).json({
      success: true,
      notification: result.notification,
      deduped: result.deduped
    })
  } catch (err) {
    console.error('新增通知失敗：', err)
    res.status(500).json({
      success: false,
      message: '新增通知失敗'
    })
  }
})

// ------------------------------------------------------
// 即時推播（SSE）
//
// EventSource 無法自訂 header，所以 token 用查詢字串帶入，
// 這裡直接驗證 JWT，不走 requireAuth（它只認 Authorization header）。
// ------------------------------------------------------
router.get('/stream', async (req, res) => {
  let userId

  try {
    const payload = jwt.verify(
      req.query.token,
      process.env.JWT_SECRET || 'secret'
    )
    userId = payload.userId
  } catch {
    return res.status(401).end()
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  res.write(': connected\n\n')

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n')
    } catch {
      clearInterval(heartbeat)
    }
  }, 25000)

  subscribe(userId, res)

  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe(userId, res)
  })
})


// 從這裡開始的路由都是使用者自己查看／設定通知，一律需要登入
router.use(requireAuth)

// ------------------------------------------------------
// 取得通知
//
// 不帶 petId：回傳這個使用者「所有寵物」的通知（給全站的通知鈴鐺用）。
// 帶 petId：只回傳該寵物的通知，且該寵物必須屬於目前登入的使用者。
// ------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const petId = req.query.petId ? Number(req.query.petId) : null

    if (petId && !(await ownsPet(petId, req.userId))) {
      return res.status(404).json({
        success: false,
        message: '找不到寵物'
      })
    }

    const result = await pool.query(
      `
      SELECT
        n.id,
        n.user_id AS "userId",
        n.pet_id AS "petId",
        p.name AS "petName",
        n.type,
        n.title,
        n.message,
        n.severity,
        n.is_read AS "isRead",
        n.read_at AS "readAt",
        n.event_at AS "eventAt",
        n.created_at AS "createdAt",
        n.metadata
      FROM notifications n
      LEFT JOIN pets p ON p.id = n.pet_id
      WHERE n.user_id = $1
        AND ($2::integer IS NULL OR n.pet_id = $2)
      ORDER BY n.created_at DESC
      LIMIT 50
      `,
      [req.userId, petId]
    )

    res.json({
      success: true,
      notifications: result.rows
    })
  } catch (err) {
    console.error('取得通知失敗：', err)
    res.status(500).json({
      success: false,
      message: '取得通知失敗'
    })
  }
})

// 未讀數量（規則同上：不帶 petId 就是全部寵物）
router.get('/unread-count', async (req, res) => {
  try {
    const petId = req.query.petId ? Number(req.query.petId) : null

    if (petId && !(await ownsPet(petId, req.userId))) {
      return res.status(404).json({
        success: false,
        message: '找不到寵物'
      })
    }

    const result = await pool.query(
      `
      SELECT COUNT(*)::integer AS count
      FROM notifications
      WHERE user_id = $1
        AND is_read = FALSE
        AND ($2::integer IS NULL OR pet_id = $2)
      `,
      [req.userId, petId]
    )

    res.json({
      success: true,
      count: result.rows[0].count
    })
  } catch (err) {
    console.error('取得未讀數量失敗：', err)
    res.status(500).json({
      success: false,
      message: '取得未讀數量失敗'
    })
  }
})

// 單筆已讀（只能標記自己的通知）
router.patch('/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      [req.params.id, req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到通知'
      })
    }

    res.json({
      success: true,
      notification: result.rows[0]
    })
  } catch (err) {
    console.error('更新通知失敗：', err)
    res.status(500).json({
      success: false,
      message: '更新通知失敗'
    })
  }
})

// 全部已讀（可選擇只標記某隻寵物的）
router.patch('/read-all', async (req, res) => {
  try {
    const petId = req.body.petId ? Number(req.body.petId) : null

    if (petId && !(await ownsPet(petId, req.userId))) {
      return res.status(404).json({
        success: false,
        message: '找不到寵物'
      })
    }

    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE user_id = $1
        AND is_read = FALSE
        AND ($2::integer IS NULL OR pet_id = $2)
      RETURNING id
      `,
      [req.userId, petId]
    )

    res.json({
      success: true,
      updated: result.rowCount
    })
  } catch (err) {
    console.error('全部已讀失敗：', err)
    res.status(500).json({
      success: false,
      message: '全部已讀失敗'
    })
  }
})

// ------------------------------------------------------
// 通知偏好：要收哪些類型的通知
// ------------------------------------------------------
router.get('/preferences', async (req, res) => {
  try {
    const prefs = await getPreferences(req.userId)
    res.json({ success: true, preferences: prefs })
  } catch (err) {
    console.error('取得通知偏好失敗：', err)
    res.status(500).json({ success: false, message: '取得通知偏好失敗' })
  }
})

router.put('/preferences', async (req, res) => {
  try {
    const prefs = await savePreferences(req.userId, req.body)
    res.json({ success: true, preferences: prefs })
  } catch (err) {
    console.error('儲存通知偏好失敗：', err)
    res.status(500).json({ success: false, message: '儲存通知偏好失敗' })
  }
})

module.exports = router