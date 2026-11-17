// ======================================================
// 貓砂盆「測試資料」種子腳本
//
// 用途：getDailyBaseline() 需要「過去 7 天、至少 3 天」有紀錄才會產生
//       「和平常比較」的那一行。相機還沒累積歷史時，用這支腳本補幾天，
//       方便驗證健康諮詢的 prompt 與畫面。
//
// 用法（在 pet-api 目錄）：
//   node scripts/seed-litter-box-test-data.js            補 5 天（預設）
//   node scripts/seed-litter-box-test-data.js --days=3   補 3 天
//   node scripts/seed-litter-box-test-data.js --undo     刪掉這支腳本補的資料
//
// 注意：
//   - 只寫入「今天以前」的日子，不動今天的真實紀錄。
//   - 全部標記 type_source = 'manual'，自動偵測不會覆蓋，也方便清除。
//   - 正式的相機資料是 type_source = 'auto'，--undo 不會碰到。
// ======================================================

const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const args = process.argv.slice(2)
const UNDO = args.includes('--undo')
const daysArg = args.find(a => a.startsWith('--days='))
const DAYS = daysArg ? Number(daysArg.split('=')[1]) : 5

const CAMERA_ID = process.env.LITTER_BOX_CAMERA_ID || 'cam2'
const TIMEZONE = 'Asia/Taipei'

// 一天三次：兩次尿尿（< 45 秒）、一次排便（>= 45 秒），符合推估規則
const PLAN = [
  { time: '09:15', type: 'urine', seconds: 32 },
  { time: '14:40', type: 'urine', seconds: 38 },
  { time: '21:05', type: 'poop', seconds: 85 }
]

function isoDaysAgo(todayISO, n) {
  const d = new Date(todayISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('缺少 DATABASE_URL（請設定在 pet-api/.env）')
  }

  const pool = require('../src/db')

  try {
    const today = await pool.query(
      `SELECT (NOW() AT TIME ZONE $1)::date::text AS today`,
      [TIMEZONE]
    )
    const todayISO = today.rows[0].today
    console.log(`台北今天：${todayISO}，相機：${CAMERA_ID}`)

    if (UNDO) {
      const preview = await pool.query(
        `SELECT date, COUNT(*)::int AS n
           FROM litter_box_visits
          WHERE camera_id = $1 AND type_source = 'manual'
          GROUP BY date ORDER BY date`,
        [CAMERA_ID]
      )
      console.log('將刪除的測試資料：', preview.rows)

      const del = await pool.query(
        `DELETE FROM litter_box_visits
          WHERE camera_id = $1 AND type_source = 'manual'`,
        [CAMERA_ID]
      )
      console.log(`已刪除 ${del.rowCount} 筆`)
      return
    }

    if (!Number.isInteger(DAYS) || DAYS < 1 || DAYS > 7) {
      throw new Error('--days 需為 1～7 的整數')
    }

    let inserted = 0

    for (let n = DAYS; n >= 1; n--) {
      const dateISO = isoDaysAgo(todayISO, n)

      for (const item of PLAN) {
        const localTs = `${dateISO} ${item.time}:00`

        const res = await pool.query(
          `INSERT INTO litter_box_visits
             (camera_id, pet_type, entered_at, exited_at,
              duration_seconds, visit_type, type_source, date)
           VALUES (
             $1, 'cat',
             ($2::timestamp AT TIME ZONE $3),
             ($2::timestamp AT TIME ZONE $3) + ($4 * INTERVAL '1 second'),
             $4, $5, 'manual', $6::date
           )`,
          [CAMERA_ID, localTs, TIMEZONE, item.seconds, item.type, dateISO]
        )
        inserted += res.rowCount
      }

      console.log(`  ${dateISO}：新增 ${PLAN.length} 筆`)
    }

    console.log(`\n共新增 ${inserted} 筆測試資料（type_source='manual'）`)

    const summary = await pool.query(
      `SELECT date, COUNT(*)::int AS visits,
              COUNT(*) FILTER (WHERE visit_type = 'urine')::int AS urine,
              COUNT(*) FILTER (WHERE visit_type = 'poop')::int AS poop,
              COUNT(*) FILTER (WHERE type_source = 'manual')::int AS manual
         FROM litter_box_visits
        WHERE camera_id = $1
          AND entered_at >= NOW() - INTERVAL '8 days'
        GROUP BY date ORDER BY date DESC`,
      [CAMERA_ID]
    )
    console.table(summary.rows)
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('失敗：', err.message)
  process.exit(1)
})
