import React, { useEffect, useMemo, useState } from 'react'
import {
  buildTimelineWithGaps,
  deriveMonitorState,
  noDataText
} from '../lib/cameraTimeline'

const CAMERA_API = import.meta.env.VITE_CAMERA_API_URL || 'http://localhost:8000'
const API = '/api'
const authHeaders = () => {
  const token = localStorage.getItem('paw-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const ranges = {
  '20m': { label: '20 分鐘', minutes: 20, bucket: 5 },
  '1h': { label: '1 小時', minutes: 60, bucket: 10 },
  '6h': { label: '6 小時', minutes: 360, bucket: 30 },
  today: { label: '今天', minutes: 1440, bucket: 60 }
}

// 貓砂盆：平均上廁所時間顯示
const formatVisitSeconds = seconds => {
  if (seconds == null) return '—'

  const value = Math.round(seconds)

  if (value < 60) return `${value} 秒`
  return `${(value / 60).toFixed(1)} 分`
}

// 排泄狀況評估的顏色
const ASSESSMENT_TONE = {
  ok: 'bg-green-50 border-green-100 text-green-700',
  watch: 'bg-amber-50 border-amber-100 text-amber-700',
  warning: 'bg-orange-50 border-orange-200 text-orange-700',
  urgent: 'bg-red-50 border-red-200 text-red-700',
  unknown: 'bg-gray-50 border-gray-100 text-gray-500'
}

export default function PetCam({ cameraId = 'cam_1' }) {
  const [status, setStatus] = useState({
    cameraId: 'cam_1',
    cameraName: 'Camera 1',
    detected: false,
    detectedType: 'pet',
    behavior: '讀取中...',
    mood: '讀取中...',
    confidence: 0,
    aspectRatio: 0,
    movement: 0,
    lastSeenAt: null,
    missingSeconds: 0,
    missingMinutes: 0,
    cameraConnected: false
  })

  const [cameraError, setCameraError] = useState(false)

  // 前端連不連得到 Python 攝影機服務（連不到時，畫面上的狀態可能是舊的）
  const [serviceReachable, setServiceReachable] = useState(true)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [range, setRange] = useState('20m')
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // ==============================
  // 即時攝影機狀態
  // ==============================
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${CAMERA_API}/status`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setStatus(await res.json())
        setServiceReachable(true)
        setStatusLoaded(true)
      } catch (err) {
        console.error('取得攝影機狀態失敗：', err)
        setServiceReachable(false)
      }
    }

    fetchStatus()
    const timer = setInterval(fetchStatus, 1000)
    return () => clearInterval(timer)
  }, [])
  // ==========================================
  // 今日寵物進出貓砂次數
  // ==========================================
  const [catStats, setCatStats] = useState({
    catCount: 0,
    isPresent: false,
    lastSeen: null,
    urineCount: 0,
    poopCount: 0,
    avgUrineSeconds: null,
    avgPoopSeconds: null,
    assessment: null,
  })

  useEffect(() => {
    const fetchCatCount = async () => {
      try {
        const res = await fetch(`${API}/cat-count`)
        if (!res.ok) return
        const data = await res.json()
        setCatStats({
          catCount: data.catCount ?? 0,
          isPresent: data.isPresent ?? false,
          lastSeen: data.lastSeen || null,
          urineCount: data.urineCount ?? 0,
          poopCount: data.poopCount ?? 0,
          avgUrineSeconds: data.avgUrineSeconds ?? null,
          avgPoopSeconds: data.avgPoopSeconds ?? null,
          assessment: data.assessment || null,
        })
      } catch {
        // 後端尚未連線時維持原數值
      }
    }

    fetchCatCount()
    const timer = setInterval(fetchCatCount, 2000)
    return () => clearInterval(timer)
  }, [])

  // ==============================
  // 攝影機歷史紀錄（以 cameraId 運作，不依賴 petId）
  // ==============================
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setTimelineLoading(true)
        const config = ranges[range]

        const url =
          range === 'today'
            ? `${API}/camera-records/today?cameraId=${cameraId}`
            : `${API}/camera-records?cameraId=${cameraId}&minutes=${config.minutes}`

        const res = await fetch(url, { headers: authHeaders() })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()
        setTimeline(groupRecords(data.records || [], config.bucket))
      } catch (err) {
        console.error('取得攝影機歷史紀錄失敗：', err)
        setTimeline([])
      } finally {
        setTimelineLoading(false)
      }
    }

    fetchHistory()
    const timer = setInterval(fetchHistory, 60000)

    return () => clearInterval(timer)
  }, [range, cameraId])

  // ==============================
  // SQL 紀錄分組
  // ==============================
  const groupRecords = (records, bucketMinutes) => {
    const groups = {}

    records.forEach(item => {
      const rawTime = item.recordedAt || item.recorded_at
      if (!rawTime) return

      const date = new Date(rawTime)
      if (isNaN(date.getTime())) return

      date.setMinutes(
        Math.floor(date.getMinutes() / bucketMinutes) * bucketMinutes,
        0,
        0
      )

      const key = date.toISOString()
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })

    const getTop = values => {
      const counts = {}

      values.filter(Boolean).forEach(value => {
        counts[value] = (counts[value] || 0) + 1
      })

      return (
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || '無資料'
      )
    }

    return Object.entries(groups)
      .map(([time, items]) => ({
        time,
        mood: getTop(items.map(x => x.mood)),
        behavior: getTop(items.map(x => x.behavior)),
        movement: Math.round(
          items.reduce(
            (sum, item) => sum + Number(item.movement || 0),
            0
          ) / items.length
        ),
        samples: items.length
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time))
  }

  // ==============================
  // 顯示格式
  // ==============================
  const formatTime = value => {
    if (!value) return '--:--'

    return new Date(value).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatMissing = () => {
    const seconds = Number(status.missingSeconds || 0)

    if (seconds < 60) return `${seconds} 秒`

    const minutes = Math.floor(seconds / 60)

    if (minutes < 60) return `${minutes} 分鐘`

    const hours = Math.floor(minutes / 60)
    const remain = minutes % 60

    return remain ? `${hours} 小時 ${remain} 分鐘` : `${hours} 小時`
  }

  const moodEmoji = mood => {
    if (!mood) return '🐾'
    if (mood.includes('活躍') || mood.includes('興奮')) return '⚡'
    if (mood.includes('好奇') || mood.includes('探索')) return '👀'
    if (mood.includes('休息') || mood.includes('放鬆') || mood.includes('慵懶')) return '💤'
    if (mood.includes('平靜') || mood.includes('舒適')) return '😌'
    if (mood.includes('觀察') || mood.includes('警戒')) return '🐱'
    if (mood.includes('未偵測')) return '📷'
    return '🐾'
  }

  const moodColor = mood => {
    if (!mood) return 'bg-gray-100 text-gray-600'
    if (mood.includes('活躍') || mood.includes('興奮')) return 'bg-orange-100 text-orange-700'
    if (mood.includes('好奇') || mood.includes('探索')) return 'bg-purple-100 text-purple-700'
    if (mood.includes('休息') || mood.includes('放鬆')) return 'bg-blue-100 text-blue-700'
    if (mood.includes('平靜')) return 'bg-green-100 text-green-700'
    if (mood.includes('觀察') || mood.includes('警戒')) return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-600'
  }

  // ==============================
  // 監控狀態（攝影機是否運作 ≠ 寵物是否在鏡頭中）
  // ==============================
  const monitor = deriveMonitorState({
    serviceReachable,
    loaded: statusLoaded,
    status
  })

  // 只有「攝影機運作中且偵測到寵物」時，即時的行為與數值才有意義
  const liveAvailable = monitor.key === 'present'

  const formatGapDuration = minutes => {
    if (minutes < 60) return `${minutes} 分鐘`

    const hours = Math.floor(minutes / 60)
    const remain = minutes % 60

    return remain ? `${hours} 小時 ${remain} 分鐘` : `${hours} 小時`
  }

  // 把沒有紀錄的時段補成「無資料」，時間軸才不會直接跳過那段時間
  const displayTimeline = useMemo(() => {
    const config = ranges[range]
    const now = new Date()

    const rangeStart =
      range === 'today'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getTime() - config.minutes * 60000)

    return buildTimelineWithGaps({
      groups: timeline,
      rangeStart,
      rangeEnd: now,
      bucketMinutes: config.bucket,
      currentBucketIsGap: monitor.key === 'absent'
    })
  }, [timeline, range, monitor.key])

  const hasGap = displayTimeline.some(item => item.type === 'gap')

  return (
    <div className="w-full min-h-full bg-gray-50 px-4 py-6">
      <div className="w-full max-w-[900px] mx-auto flex flex-col gap-5">

        {/* 標題（通知中心由上方的全域鈴鐺提供，頁面不再重複放置） */}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800">即時監控</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {status.cameraName || 'Camera 1'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            以攝影機為單位獨立運作，依 YOLO 偵測之姿態與活動量推估行為狀態
          </p>
        </div>

        {/* 攝影機 */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200">
          <div className="w-full bg-black min-h-[350px] flex items-center justify-center">
            {!cameraError ? (
              <img
                src={`${CAMERA_API}/video_feed`}
                alt="寵物即時監控"
                className="w-full max-h-[600px] object-contain"
                onLoad={() => setCameraError(false)}
                onError={() => setCameraError(true)}
              />
            ) : (
              <div className="text-center py-16">
                <p className="text-white text-sm">📷 無法載入攝影機畫面</p>
                <p className="text-gray-400 text-xs mt-2">
                  請確認 Python 攝影機服務是否正在運作
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 是否在鏡頭內 */}
        <div
          className={`rounded-2xl border p-5 ${
            monitor.key === 'present'
              ? 'bg-green-50 border-green-100'
              : monitor.key === 'absent'
                ? 'bg-orange-50 border-orange-100'
                : monitor.key === 'camera_down'
                  ? 'bg-red-50 border-red-100'
                  : 'bg-gray-50 border-gray-200'
          }`}
        >
          {monitor.key === 'present' ? (
            <>
              <p className="font-bold text-green-700">
                {status.detectedType === 'cat' ? '🐱 偵測到貓咪在鏡頭中' : status.detectedType === 'dog' ? '🐶 偵測到狗狗在鏡頭中' : '🐾 目前畫面中有偵測到目標'}
              </p>

              <p className="text-xs text-green-600 mt-2">
                最後偵測：{formatTime(status.lastSeenAt)}
              </p>
            </>
          ) : monitor.key === 'absent' ? (
            <>
              <p className="font-bold text-orange-700">
                📷 目前鏡頭範圍內未偵測到寵物
              </p>

              <p className="text-xs text-orange-600 mt-2">
                ✅ 攝影機運作中，只是畫面中沒有偵測到寵物或動態
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                <p className="text-xs text-orange-600">
                  最後偵測：{formatTime(status.lastSeenAt)}
                </p>

                <p className="text-xs text-orange-600">
                  離開鏡頭時間：{formatMissing()}
                </p>
              </div>

              {status.missingMinutes >= 20 && (
                <div className="bg-white/70 border border-orange-200 rounded-xl p-3 mt-3">
                  <p className="text-xs font-semibold text-orange-700">
                    ⚠️ 已有一段時間未偵測到寵物
                  </p>

                  <p className="text-xs text-orange-600 mt-1">
                    寵物可能位於攝影機範圍外，可查看即時畫面確認狀況。
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <p
                className={`font-bold ${
                  monitor.key === 'camera_down'
                    ? 'text-red-700'
                    : 'text-gray-600'
                }`}
              >
                📷 {monitor.label}
              </p>

              {monitor.detail && (
                <p className="text-xs text-gray-500 mt-2">{monitor.detail}</p>
              )}
            </>
          )}
        </div>
{/* 今日貓砂盆使用：次數（尿尿／大便分開）＋ 平均上廁所時間 */}
        <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🚽</span>
              <span className="font-bold text-sm text-gray-700">
                今日貓砂盆使用
              </span>
              {catStats.isPresent && (
                <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                  目前在內
                </span>
              )}
            </div>

            <span className="text-[11px] text-gray-400">
              影像推估：停留 &lt; 45 秒 = 尿尿
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">

            <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-sky-600">💧 尿尿</p>

              <p className="mt-0.5">
                <span className="text-xl font-bold text-gray-800">
                  {catStats.urineCount}
                </span>
                <span className="text-xs text-gray-500 ml-1">次</span>
              </p>

              <p className="text-[11px] text-gray-500 mt-0.5">
                平均 {formatVisitSeconds(catStats.avgUrineSeconds)}
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-600">💩 大便</p>

              <p className="mt-0.5">
                <span className="text-xl font-bold text-gray-800">
                  {catStats.poopCount}
                </span>
                <span className="text-xs text-gray-500 ml-1">次</span>
              </p>

              <p className="text-[11px] text-gray-500 mt-0.5">
                平均 {formatVisitSeconds(catStats.avgPoopSeconds)}
              </p>
            </div>

          </div>

          {catStats.assessment && (
            <div
              className={`mt-3 rounded-xl border px-3 py-2 ${
                ASSESSMENT_TONE[catStats.assessment.level] ||
                ASSESSMENT_TONE.unknown
              }`}
            >
              <p className="text-xs font-bold">
                排泄狀況：{catStats.assessment.label}
              </p>

              <div className="mt-1 space-y-1">
                {catStats.assessment.items.slice(0, 3).map((item, index) => (
                  <p key={index} className="text-[11px] leading-relaxed">
                    · <span className="font-semibold">{item.title}</span>
                    {item.text ? `：${item.text}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-2">
            次數與時間為影像推估，僅供參考，不能取代獸醫診斷。
          </p>
        </div>

        {/* 當前行為 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5">
            <p className="text-xs font-semibold text-sky-600">當前行為</p>
            <p
              className={`text-lg font-bold mt-2 ${
                liveAvailable ? 'text-gray-800' : 'text-gray-400'
              }`}
            >
              {liveAvailable ? status.behavior : noDataText(monitor.key)}
            </p>
          </div>

          <div className="bg-pink-50 border border-pink-100 rounded-2xl p-5">
            <p className="text-xs font-semibold text-pink-600">
              推測活動狀態
            </p>

            <p
              className={`text-lg font-bold mt-2 ${
                liveAvailable ? 'text-gray-800' : 'text-gray-400'
              }`}
            >
              {liveAvailable
                ? `${moodEmoji(status.mood)} ${status.mood}`
                : noDataText(monitor.key)}
            </p>

            <p className="text-[11px] text-gray-400 mt-2">
              此結果依攝影機偵測到的姿態與活動量推測，不代表寵物實際心理或醫療狀態。
            </p>
          </div>
        </div>

        {/* 數值 */}
        {liveAvailable && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 text-center">
              辨識信心度：{status.confidence}%　|　
              身體長寬比：{status.aspectRatio}　|　
              移動量：{status.movement}
            </p>
          </div>
        )}

        {/* 行為時間軸 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h3 className="font-bold text-gray-800">行為變化</h3>

              <p className="text-xs text-gray-400 mt-1">
                查看不同時間內攝影機推測的行為狀態
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {Object.entries(ranges).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    range === key
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {timelineLoading ? (
            <p className="text-center text-xs text-gray-400 py-10">
              載入行為紀錄中...
            </p>
          ) : displayTimeline.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400">
                目前沒有這段時間的行為資料
              </p>

              <p className="text-xs text-gray-300 mt-1">
                攝影機持續運作後會自動累積紀錄
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max">
                {displayTimeline.map((item, index) => (
                  <div
                    key={`${item.time}-${index}`}
                    className="relative w-[130px] text-center"
                  >
                    {item.type === 'gap' ? (
                      <>
                        <p className="text-[11px] text-gray-400">
                          {formatTime(item.time)}–{formatTime(item.endTime)}
                        </p>

                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg mx-auto my-2 bg-gray-50 border-2 border-dashed border-gray-300 text-gray-400">
                          ∅
                        </div>

                        <p className="text-xs font-semibold text-gray-400">
                          無資料
                        </p>

                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatGapDuration(item.minutes)}
                        </p>

                        <p className="text-[10px] text-gray-300 mt-1">
                          未偵測到寵物
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] text-gray-400">
                          {formatTime(item.time)}
                        </p>

                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-lg mx-auto my-2 ${moodColor(item.mood)}`}
                        >
                          {moodEmoji(item.mood)}
                        </div>

                        <p className="text-xs font-semibold text-gray-700">
                          {item.mood}
                        </p>

                        <p className="text-[10px] text-gray-400 mt-1">
                          {item.behavior}
                        </p>

                        <p className="text-[10px] text-gray-300 mt-1">
                          活動量 {item.movement}
                        </p>
                      </>
                    )}

                    {index < displayTimeline.length - 1 && (
                      <div className="absolute top-[39px] left-[87px] w-[86px] h-[2px] bg-gray-200 -z-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasGap && (
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              「無資料」表示該時段沒有偵測到寵物（例如不在鏡頭範圍內）。
              攝影機目前是否運作，請看鏡頭下方的狀態卡片；
              若攝影機或服務中斷，該時段同樣會顯示無資料。
            </p>
          )}
        </div>

        {/* 攝影機連線 */}
        <div className="flex items-center justify-center gap-2 pb-3">
          <span
            className={`w-2 h-2 rounded-full ${
              monitor.key === 'present' || monitor.key === 'absent'
                ? 'bg-green-500'
                : monitor.key === 'camera_down'
                  ? 'bg-red-500'
                  : 'bg-gray-400'
            }`}
          />

          <span className="text-xs text-gray-400">
            {monitor.key === 'present' || monitor.key === 'absent'
              ? '攝影機連線正常'
              : monitor.key === 'camera_down'
                ? '攝影機未連線'
                : monitor.key === 'service_down'
                  ? '無法連線到攝影機服務'
                  : '連線中…'}
          </span>
        </div>
      </div>
    </div>
  )
}