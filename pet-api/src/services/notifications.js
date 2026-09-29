// ======================================================
// 通知服務
//
// 集中處理：
//   1. 依飼主的通知偏好，決定要不要建立通知
//   2. 同一隻寵物、同一種類型的通知在時間窗內合併，避免洗版
//   3. 即時推播（SSE）：有新通知時主動推給正在連線的分頁
//
// 所有寫入通知的地方（AI 健康諮詢、週報、飲食提醒、攝影機）
// 都呼叫這裡的 createNotification()，不要直接寫 SQL insert，
// 才能確保偏好設定與防洗版邏輯一致套用。
// ======================================================

const pool = require('../db')

// ------------------------------------------------------
// 通知類型與預設偏好
// ------------------------------------------------------

const NOTIFICATION_TYPES = [
  'camera_missing',
  'camera_reappeared',
  'health_alert',
  'weekly_report_ready',
  'feeding_reminder'
]

const DEFAULT_PREFS = {
  camera_missing: true,
  camera_reappeared: true,
  health_alert: true,
  weekly_report_ready: true,
  feeding_reminder: true
}

// 每種類型的防洗版時間窗（小時）：
// 同一隻寵物、同一種類型，在這段時間內只保留一筆通知（用最新內容覆蓋、重新標成未讀）。
const DEDUP_HOURS = {
  camera_missing: 1,
  camera_reappeared: 1,
  health_alert: 24,
  weekly_report_ready: 24 * 6, // 不到一週內重新產生同一份週報，不重複通知
  feeding_reminder: 24
}

function sanitizePreferences(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const prefs = {}

  for (const type of NOTIFICATION_TYPES) {
    prefs[type] = src[type] === false ? false : true
  }

  return prefs
}

async function getPreferences(userId) {
  const result = await pool.query(
    'SELECT notification_preferences FROM users WHERE id = $1',
    [userId]
  )

  return sanitizePreferences(result.rows[0]?.notification_preferences)
}

async function savePreferences(userId, raw) {
  const prefs = sanitizePreferences(raw)

  await pool.query(
    'UPDATE users SET notification_preferences = $2::jsonb WHERE id = $1',
    [userId, JSON.stringify(prefs)]
  )

  return prefs
}

// ------------------------------------------------------
// SSE 即時推播：userId → 正在連線的 response 物件集合
// ------------------------------------------------------

const subscribers = new Map()

function subscribe(userId, res) {
  if (!subscribers.has(userId)) subscribers.set(userId, new Set())
  subscribers.get(userId).add(res)
}

function unsubscribe(userId, res) {
  subscribers.get(userId)?.delete(res)
}

function broadcast(userId, notification) {
  const set = subscribers.get(userId)
  if (!set || set.size === 0) return

  const payload = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`

  for (const res of set) {
    try {
      res.write(payload)
    } catch {
      set.delete(res)
    }
  }
}

// ------------------------------------------------------
// 建立通知（唯一的寫入入口）
//
// 回傳：
//   { skipped: 'muted' }              飼主關閉了這種類型
//   { skipped: 'no_owner' }           寵物沒有對應的使用者
//   { notification, deduped: bool }   成功建立／合併
// ------------------------------------------------------

async function createNotification({
  petId,
  type,
  title,
  message,
  severity = 'info',
  metadata = {}
}) {
  const petResult = await pool.query(
    'SELECT owner_id FROM pets WHERE id = $1',
    [petId]
  )

  const userId = petResult.rows[0]?.owner_id
  if (!userId) return { skipped: 'no_owner' }

  const prefs = await getPreferences(userId)
  if (prefs[type] === false) return { skipped: 'muted' }

  const dedupHours = DEDUP_HOURS[type] ?? 24

  const existing = await pool.query(
    `
    SELECT *
    FROM notifications
    WHERE user_id = $1
      AND pet_id = $2
      AND type = $3
      AND created_at >= NOW() - ($4 || ' hours')::interval
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId, petId, type, dedupHours]
  )

  let row
  let deduped = false

  if (existing.rows.length > 0) {
    deduped = true

    const updated = await pool.query(
      `
      UPDATE notifications
      SET
        title = $2,
        message = $3,
        severity = $4,
        metadata = $5::jsonb,
        event_at = NOW(),
        -- 重新出現的事件要讓使用者再看到一次，所以重設為未讀
        is_read = FALSE,
        read_at = NULL
      WHERE id = $1
      RETURNING *
      `,
      [
        existing.rows[0].id,
        title,
        message,
        severity,
        JSON.stringify(metadata)
      ]
    )

    row = updated.rows[0]
  } else {
    const inserted = await pool.query(
      `
      INSERT INTO notifications
        (user_id, pet_id, type, title, message, severity, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
      `,
      [userId, petId, type, title, message, severity, JSON.stringify(metadata)]
    )

    row = inserted.rows[0]
  }

  broadcast(userId, row)

  return { notification: row, deduped }
}

module.exports = {
  NOTIFICATION_TYPES,
  DEFAULT_PREFS,
  sanitizePreferences,
  getPreferences,
  savePreferences,
  createNotification,
  subscribe,
  unsubscribe,
  broadcast
}