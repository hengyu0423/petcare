const express = require('express')
const router = express.Router()
const pool = require('../db')
const requireAuth = require('../middleware/auth')
const { ownsPet } = require('../services/dietInsights')

const {
  createNotification,
  getPreferences,
  savePreferences,
  schedulePrune,
  CAMERA_TYPES,
  CAMERA_RETENTION_DAYS
} = require('../services/notifications')

// 通知列表的欄位（取得通知的兩個查詢共用）
const NOTIFICATION_COLUMNS = `
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
`

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
      userId,
      cameraId,
      petId,
      type,
      title,
      message,
      severity = 'info',
      metadata = {}
    } = req.body

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: '缺少必要資料 (type, title, message)'
      })
    }

    const result = await createNotification({
      userId,
      cameraId,
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
// 即時推播（SSE）— 已停用
//
// 原本這裡用 EventSource 常駐連線即時推播通知。但 Vercel 的
// function 是依「記憶體 × 執行時間」計費：一條 SSE 連線就是
// 一個 instance 一直跑到 maxDuration（60 秒）被切斷，瀏覽器
// 又自動重連，形成永動迴圈 —— 光是有人把分頁放著，一天就能
// 燒掉約 48 GB-Hrs（2 GB × 24h）。
//
// 前端已改回 30 秒 polling（隱藏的分頁不會輪詢），通知照樣
// 會到，只是最多晚 30 秒。這裡保留路由是為了讓還開著舊版頁面
// 的分頁收到 204：依 EventSource 規範，204 會讓它停止重連，
// 不會再繼續產生費用。
// ------------------------------------------------------
router.get('/stream', (req, res) => {
  res.status(204).end()
})


// 從這裡開始的路由都是使用者自己查看／設定通知，一律需要登入
router.use(requireAuth)

// ------------------------------------------------------
// 取得通知
//
// 不帶 petId：回傳這個使用者「所有寵物」的通知（給全站的通知鈴鐺用）。
// 帶 petId：只回傳該寵物的通知，且該寵物必須屬於目前登入的使用者。
//
// 回傳會分成兩類（前端才能分區顯示，不被相機動態淹沒）：
//   important  健康提醒／週報／餵食提醒：不受天數限制，最新 50 筆
//   camera     相機動態：只在保留期內（CAMERA_RETENTION_DAYS 天），最新 30 筆
//   notifications = important + camera 合成一個陣列（舊呼叫方式不變，仍能直接用）
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

    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const cameraLimit = Math.min(Number(req.query.cameraLimit) || 30, 100)

    // 順手清掉這位使用者已經超過保留期的相機動態（15 分鐘內不重複跑）
    schedulePrune(req.userId)

    const importantResult = await pool.query(
      `
      SELECT ${NOTIFICATION_COLUMNS}
      FROM notifications n
      LEFT JOIN pets p ON p.id = n.pet_id
      WHERE n.user_id = $1
        AND ($2::integer IS NULL OR n.pet_id = $2)
        AND NOT (n.type = ANY($3::text[]))
      ORDER BY n.created_at DESC
      LIMIT $4
      `,
      [req.userId, petId, CAMERA_TYPES, limit]
    )

    const cameraResult = await pool.query(
      `
      SELECT ${NOTIFICATION_COLUMNS}
      FROM notifications n
      LEFT JOIN pets p ON p.id = n.pet_id
      WHERE n.user_id = $1
        AND ($2::integer IS NULL OR n.pet_id = $2)
        AND n.type = ANY($3::text[])
        AND n.created_at >= NOW() - make_interval(days => $4::integer)
      ORDER BY n.created_at DESC
      LIMIT $5
      `,
      [req.userId, petId, CAMERA_TYPES, CAMERA_RETENTION_DAYS, cameraLimit]
    )

    res.json({
      success: true,
      important: importantResult.rows,
      camera: cameraResult.rows,
      notifications: [...importantResult.rows, ...cameraResult.rows]
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
//
// 鈴鐺上的紅點數字代表「要你處理的事」，所以預設不計相機動態；
// 要連相機動態一起算，帶 ?includeCamera=1。
router.get('/unread-count', async (req, res) => {
  try {
    const petId = req.query.petId ? Number(req.query.petId) : null
    const includeCamera = req.query.includeCamera === '1' || req.query.includeCamera === 'true'

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
        AND ($3::boolean OR NOT (type = ANY($4::text[])))
      `,
      [req.userId, petId, includeCamera, CAMERA_TYPES]
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
// 刪除通知
//
// 注意：/camera 這類寫死的路由一定要放在 /:id 之前，
// 否則 /:id 會先把它吃掉（:id 也會去查資料庫找不到 id）。
// ------------------------------------------------------

// 清除相機動態（列表上的「清除舊的相機動態」按鈕）
//
// 只刪 camera_missing / camera_reappeared 這種動態，
// 健康提醒、週報、餵食提醒永遠不會被這個端點刪掉。
// 可选帶 ?olderThanDays=7：只清超過 7 天的；不帶就是全部清掉。
router.delete('/camera', async (req, res) => {
  try {
    const raw = req.query.olderThanDays
    const olderThanDays = raw === undefined || raw === '' ? null : Number(raw)

    if (olderThanDays !== null && (!Number.isInteger(olderThanDays) || olderThanDays < 0)) {
      return res.status(400).json({
        success: false,
        message: 'olderThanDays 需要是 0 以上的整數'
      })
    }

    const result = await pool.query(
      `
      DELETE FROM notifications
      WHERE user_id = $1
        AND type = ANY($2::text[])
        AND ($3::integer IS NULL OR created_at < NOW() - make_interval(days => $3::integer))
      RETURNING id
      `,
      [req.userId, CAMERA_TYPES, olderThanDays]
    )

    res.json({
      success: true,
      deleted: result.rowCount
    })
  } catch (err) {
    console.error('清除相機動態失敗：', err)
    res.status(500).json({
      success: false,
      message: '清除相機動態失敗'
    })
  }
})

// 單筆刪除（只能刪自己的通知）
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING id
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
      deleted: result.rowCount
    })
  } catch (err) {
    console.error('刪除通知失敗：', err)
    res.status(500).json({
      success: false,
      message: '刪除通知失敗'
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