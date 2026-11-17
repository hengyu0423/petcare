const router = require('express').Router()
const pool = require('../db')
const {
  PEE_MAX_SECONDS,
  classifyByDuration,
  assessExcretion
} = require('../services/litterBoxInsights')

// ======================================================
// 貓砂盆進出紀錄
//
// pet-camtwo.py 在偵測到寵物進入畫面時呼叫 /enter 建立一筆，
// 離開時呼叫 /leave 補上離開時間與停留秒數。
//
// 相機分不出尿尿或大便，離開時用「停留時間」推估：
//   停留 < LITTER_PEE_MAX_SECONDS（預設 45 秒）→ 尿尿
//   停留 ≥ 45 秒 → 大便
// 推估結果可以透過 PATCH /visits/:id 手動修正。
//
// 次數與停留時間都由 litter_box_visits 這張表統計，
// 服務或程式重新啟動都不會歸零。
//
// 這個 router 同時掛在 /api/litter-box 與舊的 /api/cat-count，
// 舊的 petCam 頁面沿用 /api/cat-count 也能拿到今天的統計。
// ======================================================

const APP_TIMEZONE = 'Asia/Taipei'

// 沒有正常收到 /leave 的紀錄（例如程式當掉），
// 超過這個時間就不算「寵物目前在裡面」
const OPEN_VISIT_MAX_MINUTES = 30

function cameraOf(req) {
  const value =
    req.body?.cameraId ||
    req.query?.cameraId ||
    req.body?.camera ||
    'cam2'

  return String(value).slice(0, 50)
}

// HH:MM（台灣時間）
function formatTime(value) {
  if (!value) return null

  return new Date(value).toLocaleTimeString('zh-TW', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function round(value) {
  if (value == null) return null
  return Math.round(Number(value))
}

// 把還沒結束的紀錄補上結束時間（用新的進入時間當作上一筆的結束）
async function closeOpenVisits(cameraId, endAt) {
  const result = await pool.query(
    `
    UPDATE litter_box_visits
    SET
      exited_at = $2::timestamptz,
      duration_seconds = GREATEST(
        0,
        EXTRACT(EPOCH FROM ($2::timestamptz - entered_at))::int
      )
    WHERE camera_id = $1
      AND exited_at IS NULL
      AND entered_at <= $2::timestamptz
    RETURNING id, duration_seconds
    `,
    [cameraId, endAt]
  )

  // 推估類型（手動改過的紀錄不動）
  for (const row of result.rows) {
    await autoClassify(row.id, row.duration_seconds)
  }

  return result.rows.map(row => ({
    id: row.id,
    durationSeconds: row.duration_seconds
  }))
}

// 只有在「自動推估」的紀錄上才寫入類型
async function autoClassify(visitId, durationSeconds) {
  const visitType = classifyByDuration(durationSeconds)

  if (!visitType || !Number.isInteger(Number(visitId))) return

  await pool.query(
    `
    UPDATE litter_box_visits
    SET visit_type = $2
    WHERE id = $1
      AND type_source = 'auto'
      AND visit_type IS DISTINCT FROM $2
    `,
    [Number(visitId), visitType]
  )
}

async function getTodayStats(cameraId) {
  const today = await pool.query(
    `
    SELECT
      COUNT(*)::int                                     AS visits,
      COUNT(*) FILTER (WHERE visit_type = 'urine')::int AS urine,
      COUNT(*) FILTER (WHERE visit_type = 'poop')::int  AS poop,
      COALESCE(SUM(duration_seconds), 0)::int           AS total_seconds,
      COALESCE(ROUND(AVG(duration_seconds)), 0)::int    AS avg_seconds,
      ROUND(AVG(duration_seconds) FILTER (WHERE visit_type = 'urine'))::int AS avg_urine,
      ROUND(AVG(duration_seconds) FILTER (WHERE visit_type = 'poop'))::int  AS avg_poop,
      MAX(COALESCE(exited_at, entered_at))              AS last_seen
    FROM litter_box_visits
    WHERE camera_id = $1
      AND date = (NOW() AT TIME ZONE $2)::date
    `,
    [cameraId, APP_TIMEZONE]
  )

  const open = await pool.query(
    `
    SELECT id, entered_at, pet_type
    FROM litter_box_visits
    WHERE camera_id = $1
      AND exited_at IS NULL
      AND entered_at >= NOW() - ($2 * INTERVAL '1 minute')
    ORDER BY entered_at DESC
    LIMIT 1
    `,
    [cameraId, OPEN_VISIT_MAX_MINUTES]
  )

  // 近 24 小時（跨日也能正確判斷）
  const recent = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE visit_type = 'urine')::int AS urine,
      COUNT(*) FILTER (WHERE visit_type = 'poop')::int  AS poop,
      ROUND(AVG(duration_seconds) FILTER (WHERE visit_type = 'urine'))::int AS avg_urine,
      ROUND(AVG(duration_seconds) FILTER (WHERE visit_type = 'poop'))::int  AS avg_poop,
      MIN(entered_at) AS first_at
    FROM litter_box_visits
    WHERE camera_id = $1
      AND entered_at >= NOW() - INTERVAL '24 hours'
    `,
    [cameraId]
  )

  // 最近一次尿尿 / 排便（最多往回找 7 天）
  const lastTimes = await pool.query(
    `
    SELECT
      MAX(entered_at) FILTER (WHERE visit_type = 'urine') AS last_urine,
      MAX(entered_at) FILTER (WHERE visit_type = 'poop')  AS last_poop,
      MIN(entered_at) AS first_at
    FROM litter_box_visits
    WHERE camera_id = $1
      AND entered_at >= NOW() - INTERVAL '7 days'
    `,
    [cameraId]
  )

  const row = today.rows[0]
  const recentRow = recent.rows[0]
  const lastRow = lastTimes.rows[0]
  const currentVisit = open.rows[0] || null

  const hoursSince = value => {
    if (!value) return null
    return (Date.now() - new Date(value).getTime()) / 3600000
  }

  // 有紀錄以來的觀察時數（最多算 24 小時）
  const firstAt = lastRow?.first_at || recentRow?.first_at
  const observedHours = firstAt
    ? Math.min(24, hoursSince(firstAt))
    : 0

  const hoursSinceUrine = hoursSince(lastRow?.last_urine)
  const hoursSincePoop = hoursSince(lastRow?.last_poop)

  const assessment = assessExcretion({
    observedHours,
    urine24h: recentRow.urine,
    poop24h: recentRow.poop,
    avgUrineSeconds: recentRow.avg_urine,
    avgPoopSeconds: recentRow.avg_poop,
    hoursSinceUrine,
    hoursSincePoop
  })

  return {
    success: true,
    date: new Date().toLocaleDateString('sv-SE', {
      timeZone: APP_TIMEZONE
    }),
    cameraId,

    // 舊欄位（petCam 頁面 / 舊版程式仍在用）
    catCount: row.visits,
    isPresent: Boolean(currentVisit),
    lastSeen: formatTime(row.last_seen),

    // 今天
    visits: row.visits,
    urineCount: row.urine,
    poopCount: row.poop,
    totalSeconds: row.total_seconds,
    avgSeconds: row.avg_seconds,
    totalMinutes: Math.round(row.total_seconds / 60),

    // 平均上廁所時間（近 24 小時，比較穩定）
    avgUrineSeconds: recentRow.avg_urine,
    avgPoopSeconds: recentRow.avg_poop,

    // 近 24 小時次數
    urine24h: recentRow.urine,
    poop24h: recentRow.poop,

    // 沒有紀錄時要保留 null（不能寫成 round(x * 10) / 10，
    // 因為 null * 10 會變成 0，變成「0 小時前剛上過」的錯誤訊息）
    hoursSinceUrine:
      hoursSinceUrine == null ? null : round(hoursSinceUrine * 10) / 10,
    hoursSincePoop:
      hoursSincePoop == null ? null : round(hoursSincePoop * 10) / 10,

    // 推估門檻（< 45 秒 = 尿尿）
    peeMaxSeconds: PEE_MAX_SECONDS,
    estimatedType: true,

    currentVisit: currentVisit
      ? {
          id: currentVisit.id,
          enteredAt: currentVisit.entered_at,
          petType: currentVisit.pet_type
        }
      : null,

    // 排泄狀況評估
    assessment
  }
}

// ------------------------------------------------------
// 今天的統計
// GET /api/litter-box
// GET /api/litter-box?cameraId=cam2
// ------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    res.json(await getTodayStats(cameraOf(req)))
  } catch (err) {
    console.error('取得貓砂盆統計失敗：', err)
    res.status(500).json({ success: false, error: '無法取得貓砂盆統計' })
  }
})

// ------------------------------------------------------
// 進入：建立一筆還沒結束的紀錄
// POST /api/litter-box/enter
// { cameraId, petType, enteredAt }
// ------------------------------------------------------
router.post('/enter', async (req, res) => {
  const cameraId = cameraOf(req)
  const petType = String(req.body?.petType || 'cat').slice(0, 20)
  const enteredAt = req.body?.enteredAt || null

  try {
    const at = enteredAt ? new Date(enteredAt) : new Date()

    if (Number.isNaN(at.getTime())) {
      return res.status(400).json({ success: false, error: '無效的進入時間' })
    }

    // 上一筆沒有正常結束（程式重啟、斷線）就先補上結束時間，
    // 避免同一個畫面同時有兩筆「進行中」
    const closed = await closeOpenVisits(cameraId, at.toISOString())

    const inserted = await pool.query(
      `
      INSERT INTO litter_box_visits
        (camera_id, pet_type, entered_at, date)
      VALUES ($1, $2, $3::timestamptz, ($3::timestamptz AT TIME ZONE $4)::date)
      RETURNING id, camera_id, pet_type, entered_at, exited_at,
                duration_seconds, visit_type, date
      `,
      [cameraId, petType, at.toISOString(), APP_TIMEZONE]
    )

    res.status(201).json({
      success: true,
      visit: inserted.rows[0],
      closedVisits: closed,
      today: await getTodayStats(cameraId)
    })
  } catch (err) {
    console.error('建立貓砂盆紀錄失敗：', err)
    res.status(500).json({ success: false, error: '無法建立貓砂盆紀錄' })
  }
})

// ------------------------------------------------------
// 離開：補上結束時間、停留秒數與推估類型
// POST /api/litter-box/leave
// { cameraId, visitId, exitedAt }
// visitId 省略時，結束該攝影機最近一筆還沒結束的紀錄
// ------------------------------------------------------
router.post('/leave', async (req, res) => {
  const cameraId = cameraOf(req)
  const visitId = Number(req.body?.visitId)
  const exitedAt = req.body?.exitedAt || null

  try {
    const at = exitedAt ? new Date(exitedAt) : new Date()

    if (Number.isNaN(at.getTime())) {
      return res.status(400).json({ success: false, error: '無效的離開時間' })
    }

    const params = [cameraId, at.toISOString()]
    let where = `camera_id = $1 AND exited_at IS NULL`

    if (Number.isInteger(visitId)) {
      params.push(visitId)
      where += ' AND id = $3::bigint'
    }

    const updated = await pool.query(
      `
      UPDATE litter_box_visits
      SET
        exited_at = $2::timestamptz,
        duration_seconds = GREATEST(
          0,
          EXTRACT(EPOCH FROM ($2::timestamptz - entered_at))::int
        )
      WHERE id = (
        SELECT id
        FROM litter_box_visits
        WHERE ${where}
        ORDER BY entered_at DESC
        LIMIT 1
      )
      RETURNING id, camera_id, pet_type, entered_at, exited_at,
                duration_seconds, visit_type, type_source, date
      `,
      params
    )

    if (updated.rows.length === 0) {
      // 沒有進行中的紀錄（例如程式重啟後才收到離開），
      // 不當成錯誤，回傳目前統計即可
      return res.json({
        success: true,
        visit: null,
        today: await getTodayStats(cameraId)
      })
    }

    const visit = updated.rows[0]

    // 依停留時間推估尿尿／大便（手動改過的不覆蓋）
    if (visit.type_source === 'auto') {
      const type = classifyByDuration(visit.duration_seconds)

      if (type) {
        await pool.query(
          'UPDATE litter_box_visits SET visit_type = $2 WHERE id = $1',
          [visit.id, type]
        )
        visit.visit_type = type
      }
    }

    res.json({
      success: true,
      visit,
      today: await getTodayStats(cameraId)
    })
  } catch (err) {
    console.error('更新貓砂盆紀錄失敗：', err)
    res.status(500).json({ success: false, error: '無法更新貓砂盆紀錄' })
  }
})

// ------------------------------------------------------
// 手動修正類型
// PATCH /api/litter-box/visits/:id
// { visitType: 'urine' | 'poop' | null }   null = 回到自動推估
// ------------------------------------------------------
router.patch('/visits/:id', async (req, res) => {
  const id = Number(req.params.id)
  const visitType = req.body?.visitType ?? null

  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, error: '無效的紀錄 id' })
  }

  if (visitType !== null && !['urine', 'poop'].includes(visitType)) {
    return res.status(400).json({
      success: false,
      error: '類型只能是 urine、poop 或 null'
    })
  }

  try {
    const updated = await pool.query(
      `
      UPDATE litter_box_visits
      SET
        visit_type = CASE
          WHEN $2::text IS NULL THEN
            CASE WHEN duration_seconds < $3::int THEN 'urine' ELSE 'poop' END
          ELSE $2::text
        END,
        type_source = CASE WHEN $2::text IS NULL THEN 'auto' ELSE 'manual' END
      WHERE id = $1
      RETURNING id, camera_id, entered_at, exited_at, duration_seconds,
                visit_type, type_source, date
      `,
      [id, visitType, PEE_MAX_SECONDS]
    )

    if (updated.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到這筆紀錄' })
    }

    res.json({ success: true, visit: updated.rows[0] })
  } catch (err) {
    console.error('更新貓砂盆紀錄類型失敗：', err)
    res.status(500).json({ success: false, error: '無法更新類型' })
  }
})

// ------------------------------------------------------
// 每日統計（趨勢圖用）
// GET /api/litter-box/history?days=7
// ------------------------------------------------------
router.get('/history', async (req, res) => {
  const cameraId = cameraOf(req)
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90)

  try {
    const result = await pool.query(
      `
      SELECT
        date,
        COUNT(*)::int                                     AS visits,
        COUNT(*) FILTER (WHERE visit_type = 'urine')::int AS urine,
        COUNT(*) FILTER (WHERE visit_type = 'poop')::int  AS poop,
        COALESCE(SUM(duration_seconds), 0)::int           AS total_seconds,
        COALESCE(ROUND(AVG(duration_seconds)), 0)::int    AS avg_seconds,
        ROUND(AVG(duration_seconds) FILTER (WHERE visit_type = 'urine'))::int AS avg_urine_seconds,
        ROUND(AVG(duration_seconds) FILTER (WHERE visit_type = 'poop'))::int  AS avg_poop_seconds
      FROM litter_box_visits
      WHERE camera_id = $1
        AND date >= (NOW() AT TIME ZONE $3)::date - ($2 - 1)
      GROUP BY date
      ORDER BY date ASC
      `,
      [cameraId, days, APP_TIMEZONE]
    )

    res.json({
      success: true,
      cameraId,
      days,
      items: result.rows.map(row => ({
        ...row,
        totalMinutes: Math.round(row.total_seconds / 60)
      }))
    })
  } catch (err) {
    console.error('取得貓砂盆歷史失敗：', err)
    res.status(500).json({ success: false, error: '無法取得貓砂盆歷史' })
  }
})

// ------------------------------------------------------
// 某一天的明細
// GET /api/litter-box/visits?date=2026-11-17
// ------------------------------------------------------
router.get('/visits', async (req, res) => {
  const cameraId = cameraOf(req)
  const date = String(req.query.date || '').slice(0, 10)

  try {
    const result = await pool.query(
      `
      SELECT id, camera_id, pet_type, entered_at, exited_at,
             duration_seconds, visit_type, type_source, date
      FROM litter_box_visits
      WHERE camera_id = $1
        AND date = COALESCE(NULLIF($2, '')::date,
                            (NOW() AT TIME ZONE $3)::date)
      ORDER BY entered_at ASC
      `,
      [cameraId, date, APP_TIMEZONE]
    )

    res.json({
      success: true,
      cameraId,
      count: result.rows.length,
      visits: result.rows
    })
  } catch (err) {
    console.error('取得貓砂盆明細失敗：', err)
    res.status(500).json({ success: false, error: '無法取得貓砂盆明細' })
  }
})

module.exports = router

// 讓健康諮詢可以取得同一份統計與評估（與貓砂盆頁面一致）
module.exports.getTodayStats = getTodayStats
