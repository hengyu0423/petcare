const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')

const TZ = process.env.APP_TIMEZONE || 'Asia/Taipei'
const MIN_WEIGHT_KG = 0.01 // 鳥、倉鼠等小型寵物也能記錄
const MAX_WEIGHT_KG = 200

router.use(requireAuth)

// ======================================================
// 共用小工具
// ======================================================

const fail = (res, status, error) =>
  res.status(status).json({ success: false, error })

const serverError = (res, err) => {
  console.error(err)
  fail(res, 500, '伺服器錯誤')
}

// 體重轉成數字並取到小數 2 位；不合理回傳 null
function parseWeight(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < MIN_WEIGHT_KG || n > MAX_WEIGHT_KG) return null
  return Math.round(n * 100) / 100
}

const WEIGHT_RANGE_MESSAGE = `體重需介於 ${MIN_WEIGHT_KG}～${MAX_WEIGHT_KG} 公斤`

// 'YYYY-MM-DD' 且是真的存在的日期（2026-02-30 這種不算）
function isRealDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const d = new Date(`${str}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str
}

// 今天的日期（以 APP_TIMEZONE 為準），格式 'YYYY-MM-DD'
async function todayString(db = pool) {
  const r = await db.query(
    "SELECT to_char((NOW() AT TIME ZONE $1::text)::date, 'YYYY-MM-DD') AS today",
    [TZ]
  )
  return r.rows[0].today
}

// 取得「屬於目前登入使用者」的寵物；不是自己的、或 id 不合法都回傳 null
async function findOwnedPet(petId, userId, db = pool) {
  if (!/^\d+$/.test(String(petId))) return null
  const r = await db.query(
    `SELECT id, weight, to_char(birth_date, 'YYYY-MM-DD') AS birth_date
       FROM pets
      WHERE id = $1 AND owner_id = $2`,
    [petId, userId]
  )
  return r.rows[0] || null
}

async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

const RECORD_COLUMNS = `id, weight, to_char(measured_on, 'YYYY-MM-DD') AS measured_on, note`

const toRecord = row => ({
  id: row.id,
  weight: Number(row.weight),
  measured_on: row.measured_on,
  note: row.note
})

// 同一天只留一筆：再輸入同一天的體重會直接更新那一筆
async function upsertWeight(db, petId, weight, measuredOnSql, params, note) {
  const r = await db.query(
    `INSERT INTO pet_weight_records (pet_id, weight, measured_on, note)
     VALUES ($1, $2, ${measuredOnSql}, $${params.length + 3})
     ON CONFLICT (pet_id, measured_on)
     DO UPDATE SET weight = EXCLUDED.weight, note = EXCLUDED.note
     RETURNING ${RECORD_COLUMNS}`,
    [petId, weight, ...params, note ?? null]
  )
  return toRecord(r.rows[0])
}

// 寵物資料表上的 weight 永遠等於「日期最新的那筆體重紀錄」。
// 飲食計畫、餵食前檢查都是讀 pets.weight，所以更新體重後熱量建議會自動跟著變。
// 補登過去的體重不會蓋掉現在的體重；刪光紀錄則清空。
async function syncCurrentWeight(db, petId) {
  await db.query(
    `UPDATE pets
        SET weight = (SELECT weight FROM pet_weight_records
                       WHERE pet_id = $1
                       ORDER BY measured_on DESC, id DESC
                       LIMIT 1),
            updated_at = NOW()
      WHERE id = $1`,
    [petId]
  )
}

// ======================================================
// 寵物基本資料
// ======================================================

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM pets WHERE owner_id = $1 ORDER BY created_at DESC',
      [req.userId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

router.post('/', async (req, res) => {
  const { name, species, breed, gender, birthDate, weight, notes } = req.body

  const hasWeight = weight !== undefined && weight !== null && weight !== ''
  const weightValue = hasWeight ? parseWeight(weight) : null
  if (hasWeight && weightValue === null) return fail(res, 400, WEIGHT_RANGE_MESSAGE)

  try {
    const pet = await withTransaction(async db => {
      const result = await db.query(
        `INSERT INTO pets (owner_id, name, species, breed, gender, birth_date, weight, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [req.userId, name, species, breed || null, gender || 'unknown', birthDate || null, weightValue, notes || null]
      )
      const created = result.rows[0]

      // 新增時填的體重，就是成長曲線的第一個點
      if (weightValue !== null) {
        await upsertWeight(
          db, created.id, weightValue,
          "(NOW() AT TIME ZONE $3::text)::date", [TZ], null
        )
      }
      return created
    })
    res.json({ success: true, data: pet })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 只更新基本資料。體重一律走 /:id/weights，這裡不碰 pets.weight，
// 確保「目前體重」永遠等於日期最新的體重紀錄。
router.put('/:id', async (req, res) => {
  const { name, species, breed, gender, birthDate, notes } = req.body

  if (!name || !String(name).trim()) return fail(res, 400, '請填寫名字')
  if (!species) return fail(res, 400, '請選擇種類')

  try {
    const birth = birthDate ? String(birthDate).slice(0, 10) : null
    if (birth) {
      if (!isRealDate(birth)) return fail(res, 400, '生日格式不正確')
      if (birth > await todayString()) return fail(res, 400, '生日不能是未來')
    }

    const result = await pool.query(
      `UPDATE pets SET name=$1, species=$2, breed=$3, gender=$4,
       birth_date=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 AND owner_id=$8 RETURNING *`,
      [String(name).trim(), species, breed || null, gender || 'unknown', birth, notes || null, req.params.id, req.userId]
    )

    if (result.rows.length === 0) return fail(res, 404, '找不到寵物')
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    serverError(res, err)
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM pets WHERE id=$1 AND owner_id=$2 RETURNING id',
      [req.params.id, req.userId]
    )
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: '找不到寵物' })
    res.json({ success: true, message: '已刪除' })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// ======================================================
// 體重紀錄（成長曲線的資料來源）
// ======================================================

// GET /pets/:id/weights  → 依日期由舊到新
router.get('/:id/weights', async (req, res) => {
  try {
    const pet = await findOwnedPet(req.params.id, req.userId)
    if (!pet) return fail(res, 404, '找不到寵物')

    // 這個功能上線前就存在的體重（只有 pets.weight 一個值）：補成第一筆紀錄，
    // 曲線才不會是空的。ON CONFLICT DO NOTHING 讓同時打開兩個畫面也不會重複。
    await pool.query(
      `INSERT INTO pet_weight_records (pet_id, weight, measured_on, note)
       SELECT p.id, p.weight, p.updated_at::date, '原本記錄的體重'
         FROM pets p
        WHERE p.id = $1
          AND p.weight IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM pet_weight_records r WHERE r.pet_id = p.id)
       ON CONFLICT (pet_id, measured_on) DO NOTHING`,
      [pet.id]
    )

    const result = await pool.query(
      `SELECT ${RECORD_COLUMNS}
         FROM pet_weight_records
        WHERE pet_id = $1
        ORDER BY measured_on ASC, id ASC`,
      [pet.id]
    )
    res.json({ success: true, data: result.rows.map(toRecord) })
  } catch (err) {
    serverError(res, err)
  }
})

// POST /pets/:id/weights   { weight, date?, note? }
router.post('/:id/weights', async (req, res) => {
  try {
    const pet = await findOwnedPet(req.params.id, req.userId)
    if (!pet) return fail(res, 404, '找不到寵物')

    const weight = parseWeight(req.body.weight)
    if (weight === null) return fail(res, 400, WEIGHT_RANGE_MESSAGE)

    const today = await todayString()
    const date = req.body.date ? String(req.body.date).slice(0, 10) : today

    if (!isRealDate(date)) return fail(res, 400, '日期格式不正確')
    if (date > today) return fail(res, 400, '日期不能是未來')
    if (pet.birth_date && date < pet.birth_date) {
      return fail(res, 400, '日期不能早於寵物的生日')
    }

    const note = req.body.note ? String(req.body.note).trim().slice(0, 200) : null

    const record = await withTransaction(async db => {
      const saved = await upsertWeight(db, pet.id, weight, '$3::date', [date], note)
      await syncCurrentWeight(db, pet.id)
      return saved
    })

    const current = await pool.query('SELECT weight FROM pets WHERE id = $1', [pet.id])
    res.json({
      success: true,
      data: {
        record,
        currentWeight: current.rows[0].weight === null ? null : Number(current.rows[0].weight)
      }
    })
  } catch (err) {
    serverError(res, err)
  }
})

// DELETE /pets/:id/weights/:recordId
router.delete('/:id/weights/:recordId', async (req, res) => {
  try {
    const pet = await findOwnedPet(req.params.id, req.userId)
    if (!pet || !/^\d+$/.test(req.params.recordId)) return fail(res, 404, '找不到紀錄')

    const currentWeight = await withTransaction(async db => {
      const del = await db.query(
        'DELETE FROM pet_weight_records WHERE id = $1 AND pet_id = $2 RETURNING id',
        [req.params.recordId, pet.id]
      )
      if (del.rows.length === 0) return undefined

      await syncCurrentWeight(db, pet.id)
      const current = await db.query('SELECT weight FROM pets WHERE id = $1', [pet.id])
      return current.rows[0].weight === null ? null : Number(current.rows[0].weight)
    })

    if (currentWeight === undefined) return fail(res, 404, '找不到紀錄')
    res.json({ success: true, data: { currentWeight } })
  } catch (err) {
    serverError(res, err)
  }
})

// ======================================================
// 近況摘要（寵物詳細頁用）
// GET /pets/:id/overview
//   consultation：最後一次健康諮詢（問題、AI 回覆、嚴重程度）
//   mood        ：即時監控近 24 小時的狀態（最後一筆 + 最常見的狀態）
// 時間一律回傳「幾分鐘前」，不受欄位是否帶時區、伺服器時區影響。
// ======================================================

const minutesAgo = col => `FLOOR(EXTRACT(EPOCH FROM (NOW() - ${col})) / 60)::int`

async function latestConsultation(petId) {
  const q = await pool.query(
    `SELECT content, ${minutesAgo('created_at')} AS minutes_ago
       FROM health_consultations
      WHERE pet_id = $1 AND role = 'user'
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [petId]
  )
  if (q.rows.length === 0) return null
  const question = q.rows[0]

  // 那個問題之後的第一則 AI 回覆
  const a = await pool.query(
    `SELECT content, severity
       FROM health_consultations
      WHERE pet_id = $1 AND role = 'assistant'
        AND created_at >= (SELECT created_at FROM health_consultations
                            WHERE pet_id = $1 AND role = 'user'
                            ORDER BY created_at DESC, id DESC LIMIT 1)
      ORDER BY created_at ASC, id ASC LIMIT 1`,
    [petId]
  )
  const reply = a.rows[0] || null

  return {
    question: question.content,
    reply: reply?.content || null,
    severity: reply?.severity || null,
    minutesAgo: Math.max(question.minutes_ago, 0)
  }
}

async function recentMood(petId) {
  try {
    const latest = await pool.query(
      `SELECT mood, behavior, ${minutesAgo('recorded_at')} AS minutes_ago
         FROM pet_mood_records
        WHERE pet_id = $1
        ORDER BY recorded_at DESC LIMIT 1`,
      [petId]
    )
    if (latest.rows.length === 0) return null

    const counts = await pool.query(
      `SELECT mood, COUNT(*)::int AS n
         FROM pet_mood_records
        WHERE pet_id = $1 AND recorded_at >= NOW() - INTERVAL '24 hours'
        GROUP BY mood ORDER BY n DESC`,
      [petId]
    )
    const samples = counts.rows.reduce((s, r) => s + r.n, 0)
    const top = counts.rows[0]

    return {
      latest: {
        mood: latest.rows[0].mood,
        behavior: latest.rows[0].behavior,
        minutesAgo: Math.max(latest.rows[0].minutes_ago, 0)
      },
      day: top
        ? { mainMood: top.mood, percentage: Math.round((top.n / samples) * 100), samples }
        : null
    }
  } catch (err) {
    // 還沒架設監控（資料表不存在）就當作沒有資料
    if (err.code === '42P01') return null
    throw err
  }
}

router.get('/:id/overview', async (req, res) => {
  try {
    const pet = await findOwnedPet(req.params.id, req.userId)
    if (!pet) return fail(res, 404, '找不到寵物')

    const [consultation, mood] = await Promise.all([
      latestConsultation(pet.id),
      recentMood(pet.id)
    ])
    res.json({ success: true, data: { consultation, mood } })
  } catch (err) {
    serverError(res, err)
  }
})

module.exports = router