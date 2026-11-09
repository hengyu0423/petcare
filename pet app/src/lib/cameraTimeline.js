// =====================================================
// 即時監控：狀態判斷與「行為變化」時間軸補洞
//
// 背景：攝影機服務在寵物不在鏡頭中時，不會存行為紀錄，
// 所以時間軸那段時間會被直接跳過，看起來像是攝影機沒開。
// 這裡把「沒有資料」的時段明確標出來，並把「攝影機是否運作」
// 與「寵物是否在鏡頭中」分開講清楚。
// =====================================================

// 把時間往下對齊到 bucket（例如 10 分鐘一格）
export function alignDown(date, bucketMinutes) {
  const d = new Date(date)
  d.setMinutes(
    Math.floor(d.getMinutes() / bucketMinutes) * bucketMinutes,
    0,
    0
  )
  return d
}

// -----------------------------------------------------
// 監控狀態（顯示在標題下方的狀態列，以及各卡片的文字）
//
// key：
//   loading      還沒收到第一次狀態
//   service_down 前端連不到 Python 攝影機服務（畫面上的狀態可能是舊的）
//   camera_down  服務有回應，但攝影機沒連上
//   present      攝影機運作中，寵物在鏡頭中
//   absent       攝影機運作中，寵物目前不在鏡頭中
// -----------------------------------------------------
export function deriveMonitorState({ serviceReachable, loaded, status }) {
  if (!serviceReachable) {
    return {
      key: 'service_down',
      tone: 'gray',
      label: '無法連線到攝影機服務',
      detail:
        '請確認 Python 攝影機服務是否正在運作；目前畫面上的資料可能不是最新的。'
    }
  }

  if (!loaded) {
    return {
      key: 'loading',
      tone: 'gray',
      label: '正在讀取攝影機狀態…',
      detail: ''
    }
  }

  if (status.cameraConnected === false) {
    return {
      key: 'camera_down',
      tone: 'red',
      label: '攝影機未連線',
      detail:
        status.cameraError ||
        '服務有在運作，但沒有收到攝影機畫面；請確認攝影機已接上、沒有被其他程式佔用。'
    }
  }

  if (status.detected) {
    return {
      key: 'present',
      tone: 'green',
      label: '攝影機運作中・寵物在鏡頭中',
      detail: ''
    }
  }

  return {
    key: 'absent',
    tone: 'amber',
    label: '攝影機運作中・寵物目前不在鏡頭中',
    detail: ''
  }
}

// 「當前行為」「推測活動狀態」在沒有即時資料時要顯示的文字
export function noDataText(monitorKey) {
  switch (monitorKey) {
    case 'absent':
      return '無資料（寵物不在鏡頭中）'
    case 'camera_down':
      return '無資料（攝影機未連線）'
    case 'service_down':
      return '無資料（無法連線到攝影機服務）'
    default:
      return '讀取中...'
  }
}

// -----------------------------------------------------
// 行為變化時間軸：把沒有紀錄的時段補成「無資料」
//
// groups：已依 bucket 分組的紀錄 [{ time, mood, behavior, movement, samples }]
// 回傳：依時間排序，data 或 gap 兩種項目。
//       連續沒有紀錄的格子會合併成一個 gap（含 minutes）。
// currentBucketIsGap：目前這一格還沒有紀錄時，是否算「無資料」。
//   寵物剛好不在鏡頭中時要算；否則可能只是這一格剛開始、紀錄還沒存，先不算。
// -----------------------------------------------------
export function buildTimelineWithGaps({
  groups,
  rangeStart,
  rangeEnd,
  bucketMinutes,
  currentBucketIsGap = false
}) {
  const step = bucketMinutes * 60000
  const byTime = new Map(
    groups.map(g => [new Date(g.time).getTime(), g])
  )

  const first = alignDown(rangeStart, bucketMinutes).getTime()
  const last = alignDown(rangeEnd, bucketMinutes).getTime()

  const items = []
  let gap = null

  const closeGap = () => {
    if (!gap) return

    items.push({
      type: 'gap',
      time: new Date(gap.start).toISOString(),
      endTime: new Date(gap.end).toISOString(),
      minutes: gap.buckets * bucketMinutes
    })

    gap = null
  }

  for (let t = first; t <= last; t += step) {
    const group = byTime.get(t)

    if (group) {
      closeGap()
      items.push({ type: 'data', ...group })
      continue
    }

    // 目前這一格還在累積中，沒有紀錄不一定是無資料
    if (t === last && !currentBucketIsGap) continue

    if (!gap) {
      gap = { start: t, end: t + step, buckets: 1 }
    } else {
      gap.end = t + step
      gap.buckets += 1
    }
  }

  closeGap()

  // 範圍外或對齊誤差造成、但實際有紀錄的群組也要保留
  const inRange = new Set(items.filter(i => i.type === 'data').map(i => new Date(i.time).getTime()))
  groups.forEach(g => {
    if (!inRange.has(new Date(g.time).getTime())) {
      items.push({ type: 'data', ...g })
    }
  })

  return items.sort((a, b) => new Date(a.time) - new Date(b.time))
}
