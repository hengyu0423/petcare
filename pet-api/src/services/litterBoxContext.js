// ======================================================
// 健康諮詢 × 貓砂盆數據
//
// 飼主問到尿尿、排便、貓砂盆時，把攝影機的統計整理成一小段文字，
// 放進 AI 的 prompt，讓回答可以「和這隻貓平常的狀況比較」。
//
// 設計重點：
//   1. 只在「貓」且「問題和如廁有關」時才加，避免每次提問都多花 token。
//   2. 沒有紀錄（資料不足）就不加，不要讓 AI 亂猜。
//   3. 任何失敗都回傳空字串，健康諮詢照常運作。
//   4. 相機分不出尿尿或大便（用停留時間推估），也分不出是哪一隻貓，
//      所以在文字裡明講，要求 AI 用「可能」「建議觀察」的語氣。
//
// 可用環境變數（都有預設值）：
//   LITTER_BOX_CAMERA_ID  使用哪一台貓砂盆相機，預設 cam2
//   LITTER_BOX_PET_ID     設定後只有這隻寵物的諮詢會帶入貓砂盆數據
//                         （相機沒有綁定寵物；多位使用者或多隻貓時建議設定）
// ======================================================

const pool = require('../db')
const { getTodayStats } = require('../routes/litterBox')

const APP_TIMEZONE = 'Asia/Taipei'

const LITTER_TOPIC_PATTERN =
  /尿|貓砂|便秘|排便|大便|便便|上廁所|如廁|拉肚子|腹瀉/

function isLitterBoxTopic(text = '') {
  return LITTER_TOPIC_PATTERN.test(String(text))
}

// 過去 7 天（不含今天）每天進出次數的平均；少於 3 天有資料就不算
async function getDailyBaseline(cameraId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS visits
    FROM litter_box_visits
    WHERE camera_id = $1
      AND date >= (NOW() AT TIME ZONE $2)::date - 7
      AND date <  (NOW() AT TIME ZONE $2)::date
    GROUP BY date
    `,
    [cameraId, APP_TIMEZONE]
  )

  const days = result.rows.length
  if (days < 3) return null

  const total = result.rows.reduce((sum, row) => sum + row.visits, 0)

  return {
    days,
    avgVisits: Math.round((total / days) * 10) / 10
  }
}

function seconds(value) {
  return value == null ? null : `${Math.round(value)} 秒`
}

function hours(value) {
  return value == null ? null : `${Math.round(value * 10) / 10} 小時`
}

async function buildLitterBoxBlock({ petId, species, question }) {
  try {
    if (species !== 'cat') return ''
    if (!isLitterBoxTopic(question)) return ''

    const onlyPetId = process.env.LITTER_BOX_PET_ID
    if (onlyPetId && String(petId) !== String(onlyPetId)) return ''

    const cameraId = process.env.LITTER_BOX_CAMERA_ID || 'cam2'

    const stats = await getTodayStats(cameraId)
    const assessment = stats.assessment

    // 完全沒有資料：不要放進 prompt
    if (!assessment || assessment.level === 'unknown') return ''

    const baseline = await getDailyBaseline(cameraId)

    const lines = []

    lines.push(
      `- 近 24 小時：推估尿尿 ${stats.urine24h} 次、排便 ${stats.poop24h} 次`
    )

    if (stats.avgUrineSeconds != null || stats.avgPoopSeconds != null) {
      const parts = []
      if (stats.avgUrineSeconds != null) {
        parts.push(`尿尿平均停留 ${seconds(stats.avgUrineSeconds)}`)
      }
      if (stats.avgPoopSeconds != null) {
        parts.push(`排便平均停留 ${seconds(stats.avgPoopSeconds)}`)
      }
      lines.push(`- ${parts.join('、')}`)
    }

    const since = []
    if (stats.hoursSinceUrine != null) {
      since.push(`距上次尿尿約 ${hours(stats.hoursSinceUrine)}`)
    }
    if (stats.hoursSincePoop != null) {
      since.push(`距上次排便約 ${hours(stats.hoursSincePoop)}`)
    }
    if (since.length > 0) lines.push(`- ${since.join('、')}`)

    if (baseline) {
      lines.push(
        `- 過去 ${baseline.days} 天平均每天進出貓砂盆 ${baseline.avgVisits} 次，` +
          `今天已 ${stats.visits} 次`
      )
    }

    const flagged = (assessment.items || []).filter(
      item => item.level !== 'ok'
    )

    if (flagged.length > 0) {
      lines.push(
        `- 系統自動評估（${assessment.label}）：` +
          flagged.map(item => item.title).join('；')
      )
    } else if (assessment.enoughData) {
      lines.push('- 系統自動評估：目前沒有明顯異常')
    }

    return `
【貓砂盆攝影機紀錄（自動統計，僅供參考）】

${lines.join('\n')}

使用這份紀錄的規則：

- 相機分不出尿尿或排便（用停留時間推估），也分不出是哪一隻貓，
  這些數字只能當「提醒」，不能當診斷。
- 優先拿來和「平常」比較，不要逐項複述數字。
- 用「可能」「建議持續觀察」的語氣，不要直接說貓得了某種病。
- 若紀錄顯示很久沒有尿尿，或飼主描述尿不出來，依參考資料的分級處理。
`
  } catch (err) {
    console.error('貓砂盆數據讀取失敗（已略過）：', err.message)
    return ''
  }
}

module.exports = {
  isLitterBoxTopic,
  buildLitterBoxBlock
}
