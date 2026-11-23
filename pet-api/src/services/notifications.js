// ======================================================
// 通知服務
//
// 集中處理：
//   1. 依飼主的通知偏好，決定要不要建立通知
//   2. 同一隻寵物、同一種類型的通知在時間窗內合併，避免洗版
//   3. 即時推播（SSE）：有新通知時主動推給正在連線的分頁
//   4. 過期清理：相機動態只留 RETENTION_DAYS 天，
//      健康提醒／週報／餵食提醒不設到期，不會被自動刪除
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

// 相機動態（「好久沒看到寵物」「又出現了」）多半是角度、光線、貓在鏡頭外，
// 不是要飼主處理的事，所以只保留 30 天，時間到自動清掉。
// 只有列在這裡的類型會自動刪除：health_alert / weekly_report_ready /
// feeding_reminder 是健康與照護相關，不設到期，永遠保留。
const RETENTION_DAYS = {
  camera_missing: 30,
  camera_reappeared: 30
}

const CAMERA_TYPES = Object.keys(RETENTION_DAYS)

// 相機動態的最長保留天數（實際過期由 pruneOldNotifications 逐類型判斷）
const CAMERA_RETENTION_DAYS = CAMERA_TYPES.length
  ? Math.max(...Object.values(RETENTION_DAYS))
  : 0

// 同一個使用者最多每 15 分鐘做一次清理，避免每次建立通知都跑一次 DELETE。
const PRUNE_INTERVAL_MS = 15 * 60 * 1000
const lastPruneAt = new Map()

// ------------------------------------------------------
// 清理過期通知（只清 RETENTION_DAYS 裡有列出的類型）
// ------------------------------------------------------

async function pruneOldNotifications(userId) {
  const rules = Object.entries(RETENTION_DAYS)
  if (rules.length === 0) return 0

  const result = await pool.query(
    `
    DELETE FROM notifications n
    WHERE n.user_id = $1
      AND EXISTS (
        SELECT 1
        FROM unnest($2::text[], $3::int[]) AS rule(type, days)
        WHERE rule.type = n.type
          AND n.created_at < NOW() - make_interval(days => rule.days)
      )
    RETURNING n.id
    `,
    [userId, rules.map(([type]) => type), rules.map(([, days]) => days)]
  )

  return result.rowCount
}

function schedulePrune(userId) {
  if (!userId) return

  const now = Date.now()
  if ((lastPruneAt.get(userId) || 0) > now - PRUNE_INTERVAL_MS) return

  lastPruneAt.set(userId, now)

  pruneOldNotifications(userId).catch(err => {
    console.error('清理過期通知失敗：', err)
  })
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
  userId,
  cameraId,
  petId,
  type,
  title,
  message,
  severity = 'info',
  metadata = {}
}) {
  let targetUserId = userId

  if (!targetUserId && petId) {
    const petResult = await pool.query(
      'SELECT owner_id FROM pets WHERE id = $1',
      [petId]
    )
    targetUserId = petResult.rows[0]?.owner_id
  }

  // 若仍無 targetUserId（例如攝影機獨立運作），自動關聯到系統第一個使用者
  if (!targetUserId) {
    const userRes = await pool.query('SELECT id FROM users ORDER BY id ASC LIMIT 1')
    targetUserId = userRes.rows[0]?.id
  }

  if (!targetUserId) return { skipped: 'no_owner' }

  // 驗證 petId 是否在資料庫中存在；若已被刪除或不存在則設為 null，避免外鍵錯誤
  let validPetId = null
  if (petId) {
    const chk = await pool.query('SELECT id FROM pets WHERE id = $1', [petId])
    if (chk.rows.length > 0) validPetId = petId
  }

  if (cameraId && !metadata.cameraId) {
    metadata.cameraId = cameraId
  }

  // 攝影機通知（以攝影機為單位，通知給所有註冊使用者，不限於 user 1）
  const isCameraNotification = type.startsWith('camera_') || Boolean(cameraId)
  if (isCameraNotification) {
    const usersResult = await pool.query('SELECT id FROM users')
    const userIds = usersResult.rows.map(u => u.id)
    let lastRow = null
    let anyDeduped = false

    for (const uid of userIds) {
      const prefs = await getPreferences(uid)
      if (prefs[type] === false) continue

      const dedupHours = DEDUP_HOURS[type] ?? 24
      const existing = await pool.query(
        `
        SELECT *
        FROM notifications
        WHERE user_id = $1
          AND pet_id IS NULL
          AND type = $2
          AND (metadata->>'cameraId' = $3 OR $3 IS NULL OR metadata->>'cameraId' IS NULL)
          AND created_at >= NOW() - ($4 || ' hours')::interval
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [uid, type, cameraId || null, dedupHours]
      )

      let r
      if (existing.rows.length > 0) {
        anyDeduped = true
        const updated = await pool.query(
          `
          UPDATE notifications
          SET
            title = $2,
            message = $3,
            severity = $4,
            metadata = $5::jsonb,
            event_at = NOW(),
            is_read = FALSE,
            read_at = NULL
          WHERE id = $1
          RETURNING *
          `,
          [existing.rows[0].id, title, message, severity, JSON.stringify(metadata)]
        )
        r = updated.rows[0]
      } else {
        const inserted = await pool.query(
          `
          INSERT INTO notifications
            (user_id, pet_id, type, title, message, severity, metadata)
          VALUES ($1, NULL, $2, $3, $4, $5, $6::jsonb)
          RETURNING *
          `,
          [uid, type, title, message, severity, JSON.stringify(metadata)]
        )
        r = inserted.rows[0]
      }
      broadcast(uid, r)
      lastRow = r

      // 順手清掉這位使用者過期的相機動態（健康／週報不会被清）
      schedulePrune(uid)
    }

    return { notification: lastRow, deduped: anyDeduped }
  }

  const prefs = await getPreferences(targetUserId)
  if (prefs[type] === false) return { skipped: 'muted' }

  const dedupHours = DEDUP_HOURS[type] ?? 24

  let existing
  if (validPetId) {
    existing = await pool.query(
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
      [targetUserId, validPetId, type, dedupHours]
    )
  } else {
    existing = await pool.query(
      `
      SELECT *
      FROM notifications
      WHERE user_id = $1
        AND pet_id IS NULL
        AND type = $2
        AND (metadata->>'cameraId' = $3 OR $3 IS NULL OR metadata->>'cameraId' IS NULL)
        AND created_at >= NOW() - ($4 || ' hours')::interval
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [targetUserId, type, cameraId || null, dedupHours]
    )
  }

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
      [targetUserId, validPetId, type, title, message, severity, JSON.stringify(metadata)]
    )

    row = inserted.rows[0]
  }

  broadcast(targetUserId, row)
  schedulePrune(targetUserId)

  return { notification: row, deduped }
}

module.exports = {
  NOTIFICATION_TYPES,
  DEFAULT_PREFS,
  CAMERA_TYPES,
  RETENTION_DAYS,
  CAMERA_RETENTION_DAYS,
  sanitizePreferences,
  getPreferences,
  savePreferences,
  createNotification,
  pruneOldNotifications,
  schedulePrune,
  subscribe,
  unsubscribe,
  broadcast
}