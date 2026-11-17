// ======================================================
// 貓砂盆使用狀況 → 排泄健康評估
//
// 相機只看得到「貓在貓砂盆裡」，分不出尿尿或大便，
// 所以用停留時間推估：
//   停留 < 45 秒 → 尿尿（可調，LITTER_PEE_MAX_SECONDS）
//   停留 ≥ 45 秒 → 大便
// 推估結果存進資料庫，之後可以手動改成正確的類型。
//
// 判斷門檻參考一般健康成貓的統計值，僅供提醒，
// 不能取代獸醫診斷：
//   尿尿 2～4 次/天、間隔約 6～12 小時
//   大便 1～2 次/天、超過 48 小時沒排便要留意
//   蹲很久、反覆短暫進出 → 可能排尿／排便困難
// ======================================================

const PEE_MAX_SECONDS = Math.max(
  5,
  Number(process.env.LITTER_PEE_MAX_SECONDS) || 45
)

// 停留時間 → 推估類型
function classifyByDuration(seconds) {
  const value = Number(seconds)

  if (!Number.isFinite(value) || value < 0) return null

  return value < PEE_MAX_SECONDS ? 'urine' : 'poop'
}

const LEVEL_RANK = {
  ok: 0,
  unknown: 0,
  watch: 1,
  warning: 2,
  urgent: 3
}

const LEVEL_LABEL = {
  ok: '正常',
  unknown: '資料不足',
  watch: '留意',
  warning: '建議就醫',
  urgent: '儘快就醫'
}

function worstLevel(levels) {
  return levels.reduce(
    (worst, level) =>
      LEVEL_RANK[level] > LEVEL_RANK[worst] ? level : worst,
    'ok'
  )
}

// 分鐘數顯示：95 → 1.6 分鐘
function minutes(seconds) {
  if (seconds == null) return null
  return Math.round((seconds / 60) * 10) / 10
}

function hoursOf(value) {
  if (value == null) return null
  return Math.round(value * 10) / 10
}

/**
 * @param {object} input
 * @param {number} input.observedHours      有紀錄以來的觀察時數（最多 24）
 * @param {number} input.urine24h           近 24 小時尿尿次數
 * @param {number} input.poop24h            近 24 小時排便次數
 * @param {number} input.avgUrineSeconds    尿尿平均停留秒數
 * @param {number} input.avgPoopSeconds     排便平均停留秒數
 * @param {number|null} input.hoursSinceUrine
 * @param {number|null} input.hoursSincePoop
 */
function assessExcretion({
  observedHours = 0,
  urine24h = 0,
  poop24h = 0,
  avgUrineSeconds = null,
  avgPoopSeconds = null,
  hoursSinceUrine = null,
  hoursSincePoop = null
} = {}) {
  const items = []

  const add = (level, title, text) => {
    items.push({ level, label: LEVEL_LABEL[level], title, text })
  }

  // 完全沒有資料：不要亂嚇人
  if (observedHours <= 0) {
    return {
      level: 'unknown',
      label: LEVEL_LABEL.unknown,
      peeMaxSeconds: PEE_MAX_SECONDS,
      items: [
        {
          level: 'unknown',
          label: LEVEL_LABEL.unknown,
          title: '今天還沒有紀錄',
          text: '攝影機偵測到貓咪進出貓砂盆後，才會開始統計與評估。'
        }
      ]
    }
  }

  const enoughData = observedHours >= 12

  // ---------- 尿尿 ----------
  if (hoursSinceUrine != null && hoursSinceUrine >= 24) {
    add(
      'urgent',
      '超過 24 小時沒有排尿',
      '可能排尿困難或尿道阻塞，尤其公貓風險高，請立即聯絡獸醫。'
    )
  } else if (hoursSinceUrine != null && hoursSinceUrine >= 12) {
    add(
      'warning',
      `距上次尿尿已 ${hoursOf(hoursSinceUrine)} 小時`,
      '超過一般 6～12 小時的間隔，請留意是否有排尿困難，必要時就醫。'
    )
  }

  if (enoughData) {
    if (urine24h === 0) {
      add('warning', '近 24 小時沒有尿尿紀錄', '請確認貓咪是否飲水不足或排尿困難。')
    } else if (urine24h === 1) {
      add('watch', '尿尿次數偏少', '近 24 小時只有 1 次，低於常見的 2～4 次。')
    } else if (urine24h >= 6) {
      add(
        'warning',
        '尿尿次數偏多',
        `近 24 小時 ${urine24h} 次，若伴隨每次只有幾滴、一直進出貓砂盆，請盡速就醫。`
      )
    }
  }

  // 反覆短暫進出：典型「蹲一下又出來」的排尿困難表現
  if (urine24h >= 4 && avgUrineSeconds != null && avgUrineSeconds <= 20) {
    add(
      'warning',
      '反覆短暫進出貓砂盆',
      `尿尿次數多（${urine24h} 次）但每次只停留約 ${Math.round(avgUrineSeconds)} 秒，` +
        '可能是排尿不順或頻尿，請觀察尿量並考慮就醫。'
    )
  }

  // ---------- 大便 ----------
  if (hoursSincePoop != null && hoursSincePoop >= 48) {
    add(
      'warning',
      `超過 ${Math.floor(hoursSincePoop / 24)} 天沒有排便`,
      '一般貓咪超過 48 小時沒排便就要留意，可能是便秘，建議就醫檢查。'
    )
  } else if (hoursSincePoop != null && hoursSincePoop >= 30) {
    add(
      'watch',
      `距上次排便已 ${hoursOf(hoursSincePoop)} 小時`,
      '接近 48 小時的上限，請留意是否還有排便。'
    )
  }

  if (enoughData && poop24h >= 3) {
    add(
      'watch',
      '排便次數偏多',
      `近 24 小時 ${poop24h} 次，超過常見的 1～2 次，留意是否有軟便或腹瀉。`
    )
  }

  // ---------- 停留時間（蹲很久） ----------
  if (avgUrineSeconds != null && avgUrineSeconds >= 90) {
    add(
      'warning',
      '排尿停留時間偏長',
      `尿尿平均停留約 ${minutes(avgUrineSeconds)} 分鐘，可能排尿不順或用力，建議就醫確認。`
    )
  }

  if (avgPoopSeconds != null && avgPoopSeconds >= 300) {
    add(
      'watch',
      '排便停留時間偏長',
      `排便平均停留約 ${minutes(avgPoopSeconds)} 分鐘，若同時糞便乾硬，可能是便秘。`
    )
  }

  if (items.length === 0) {
    add(
      'ok',
      '目前沒有明顯異常',
      enoughData
        ? '次數與停留時間都在常見範圍內，繼續觀察即可。'
        : '資料還不到 12 小時，次數判斷僅供參考。'
    )
  }

  const level = worstLevel(items.map(item => item.level))

  return {
    level,
    label: LEVEL_LABEL[level],
    // 推估用的門檻，前端可以顯示說明
    peeMaxSeconds: PEE_MAX_SECONDS,
    enoughData,
    observedHours: hoursOf(observedHours),
    items
  }
}

module.exports = {
  PEE_MAX_SECONDS,
  classifyByDuration,
  assessExcretion
}
