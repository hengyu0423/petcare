import { useEffect, useMemo, useState } from 'react'
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

// SQL 紀錄分組（放在模組層，effect 才能安全使用）
function groupRecords(records, bucketMinutes) {
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

const MOOD_ICON = {
  active: <><path d="M13 3 5 13h5l-1 8 9-11h-5l1-7Z" /></>,
  curious: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></>,
  rest: <><path d="M19 15.5A7.5 7.5 0 0 1 8.5 5a7.5 7.5 0 1 0 10.5 10.5Z" /></>,
  calm: <><circle cx="12" cy="12" r="8" /><path d="M8.5 13.5c1.8 2 5.2 2 7 0" /><path d="M9 9.5h.01M15 9.5h.01" /></>,
  alert: <><path d="M12 4.5 20.5 19.5h-17L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>,
  none: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M4 18l16-12" /></>,
  paw: <><ellipse cx="7" cy="8" rx="2" ry="2.4" /><ellipse cx="12" cy="5.8" rx="2" ry="2.4" /><ellipse cx="17" cy="8" rx="2" ry="2.4" /><path d="M12 11c-3 0-5.5 2.2-5.5 4.8 0 1.7 1.4 2.9 3 2.9 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-1.2 3-2.9C17.5 13.2 15 11 12 11Z" /></>
}

function moodKey(mood) {
  if (!mood) return 'paw'
  if (mood.includes('活躍') || mood.includes('興奮')) return 'active'
  if (mood.includes('好奇') || mood.includes('探索')) return 'curious'
  if (mood.includes('休息') || mood.includes('放鬆') || mood.includes('慵懶')) return 'rest'
  if (mood.includes('平靜') || mood.includes('舒適')) return 'calm'
  if (mood.includes('觀察') || mood.includes('警戒')) return 'alert'
  if (mood.includes('未偵測')) return 'none'
  return 'paw'
}

function MoodIcon({ mood, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {MOOD_ICON[moodKey(mood)]}
    </svg>
  )
}

const moodColor = mood => {
  const key = moodKey(mood)
  if (key === 'active') return 'bg-[#fff3d6] text-[#c96f2e]'
  if (key === 'curious') return 'bg-[#f3edfa] text-[#7a5a9e]'
  if (key === 'rest') return 'bg-[#eaf1f4] text-[#3f6b7a]'
  if (key === 'calm') return 'bg-pine-50 text-pine-700'
  if (key === 'alert') return 'bg-[#ffb31f]/20 text-[#a5681c]'
  return 'bg-[#faf7ef] text-ink-soft'
}

const cardCls = 'rounded-3xl border border-[#f3e3cd] bg-plate'

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
    <div className="w-full min-h-full bg-paper px-4 py-6">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">

        {/* 標題（通知中心由上方的全域鈴鐺提供，頁面不再重複放置） */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-brand text-2xl font-extrabold text-pine-900">即時監控</h2>
            <span className="rounded-full border border-[#f0d9b5] bg-[#fff8e9] px-2.5 py-0.5 text-xs font-bold text-[#a5681c]">
              {status.cameraName || 'Camera 1'}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            以攝影機為單位獨立運作，依 YOLO 偵測之姿態與活動量推估行為狀態
          </p>
        </div>

        {/* 攝影機 */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="flex min-h-[350px] w-full items-center justify-center bg-pine-900">
            {!cameraError ? (
              <img
                src={`${CAMERA_API}/video_feed`}
                alt="寵物即時監控"
                className="max-h-[600px] w-full object-contain"
                onLoad={() => setCameraError(false)}
                onError={() => setCameraError(true)}
              />
            ) : (
              <div className="py-16 text-center text-[#fdf8ec]">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <MoodIcon mood="未偵測" size={24} />
                </span>
                <p className="mt-3 text-sm font-semibold">無法載入攝影機畫面</p>
                <p className="mt-2 text-xs text-[#fdf8ec]/70">
                  請確認 Python 攝影機服務是否正在運作
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 是否在鏡頭內 */}
        <div
          className={`rounded-3xl border p-5 ${
            monitor.key === 'present'
              ? 'border-pine-100 bg-pine-50'
              : monitor.key === 'absent'
                ? 'border-[#f0d9b5] bg-[#fff8e9]'
                : monitor.key === 'camera_down'
                  ? 'border-[#f3c2b8] bg-[#fdf0ec]'
                  : 'border-[#eae6d8] bg-[#faf7ef]'
          }`}
        >
          {monitor.key === 'present' ? (
            <>
              <p className="flex items-center gap-2 font-bold text-pine-800">
                <MoodIcon mood={status.detectedType === 'cat' ? '觀察' : status.detectedType === 'dog' ? '活躍' : status.mood} size={18} />
                {status.detectedType === 'cat' ? '偵測到貓咪在鏡頭中' : status.detectedType === 'dog' ? '偵測到狗狗在鏡頭中' : '目前畫面中有偵測到目標'}
              </p>
              <p className="mt-2 text-xs text-pine-700/80">
                最後偵測：{formatTime(status.lastSeenAt)}
              </p>
            </>
          ) : monitor.key === 'absent' ? (
            <>
              <p className="flex items-center gap-2 font-bold text-[#7a5200]">
                <MoodIcon mood="未偵測" size={18} />
                目前鏡頭範圍內未偵測到寵物
              </p>
              <p className="mt-2 text-xs text-[#a5681c]">
                攝影機運作中，只是畫面中沒有偵測到寵物或動態
              </p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                <p className="text-xs text-[#a5681c]">最後偵測：{formatTime(status.lastSeenAt)}</p>
                <p className="text-xs text-[#a5681c]">離開鏡頭時間：{formatMissing()}</p>
              </div>
              {status.missingMinutes >= 20 && (
                <div className="mt-3 rounded-xl border border-[#f0d9b5] bg-plate/80 p-3">
                  <p className="text-xs font-bold text-[#7a5200]">已有一段時間未偵測到寵物</p>
                  <p className="mt-1 text-xs text-[#a5681c]">
                    寵物可能位於攝影機範圍外，可查看即時畫面確認狀況。
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className={`flex items-center gap-2 font-bold ${monitor.key === 'camera_down' ? 'text-[#b4552f]' : 'text-ink'}`}>
                <MoodIcon mood="未偵測" size={18} />
                {monitor.label}
              </p>
              {monitor.detail && <p className="mt-2 text-xs text-ink-soft">{monitor.detail}</p>}
            </>
          )}
        </div>

        {/* 當前行為 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-[#d5e4ea] bg-[#eaf1f4] p-5">
            <p className="text-xs font-bold text-[#3f6b7a]">當前行為</p>
            <p className={`mt-2 text-lg font-extrabold ${liveAvailable ? 'text-pine-900' : 'text-ink-soft/70'}`}>
              {liveAvailable ? status.behavior : noDataText(monitor.key)}
            </p>
          </div>
          <div className="rounded-3xl border border-[#f0d9b5] bg-[#fff8e9] p-5">
            <p className="text-xs font-bold text-[#a5681c]">推測活動狀態</p>
            <p className={`mt-2 flex items-center gap-1.5 text-lg font-extrabold ${liveAvailable ? 'text-[#7a5200]' : 'text-ink-soft/70'}`}>
              {liveAvailable ? <><MoodIcon mood={status.mood} size={19} /> {status.mood}</> : noDataText(monitor.key)}
            </p>
            <p className="mt-2 text-[11px] text-[#a5681c]/90">
              此結果依攝影機偵測到的姿態與活動量推測，不代表寵物實際心理或醫療狀態。
            </p>
          </div>
        </div>

        {/* 數值 */}
        {liveAvailable && (
          <div className={`${cardCls} px-4 py-3`}>
            <p className="text-center text-xs text-ink-soft">
              辨識信心度 {status.confidence}% · 身體長寬比 {status.aspectRatio} · 移動量 {status.movement}
            </p>
          </div>
        )}

        {/* 行為時間軸 */}
        <div className={`${cardCls} p-5`}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-brand text-base font-extrabold text-pine-900">行為變化</h3>
              <p className="mt-1 text-xs text-ink-soft">查看不同時間內攝影機推測的行為狀態</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ranges).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                    range === key
                      ? 'bg-pine-800 text-[#fdf8ec]'
                      : 'bg-[#faf7ef] text-ink-soft hover:bg-[#f2ead8]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {timelineLoading ? (
            <p className="py-10 text-center text-xs text-ink-soft">載入行為紀錄中...</p>
          ) : displayTimeline.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-ink-soft">目前沒有這段時間的行為資料</p>
              <p className="mt-1 text-xs text-ink-soft/70">攝影機持續運作後會自動累積紀錄</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max">
                {displayTimeline.map((item, index) => (
                  <div key={`${item.time}-${index}`} className="relative w-[130px] text-center">
                    {item.type === 'gap' ? (
                      <>
                        <p className="text-[11px] tabular-nums text-ink-soft/80">
                          {formatTime(item.time)}–{formatTime(item.endTime)}
                        </p>
                        <div className="mx-auto my-2 flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-[#ddd8c8] bg-[#faf7ef] text-ink-soft/60">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <path d="M6 12h12" />
                          </svg>
                        </div>
                        <p className="text-xs font-semibold text-ink-soft">無資料</p>
                        <p className="mt-1 text-[10px] tabular-nums text-ink-soft/80">{formatGapDuration(item.minutes)}</p>
                        <p className="mt-1 text-[10px] text-ink-soft/60">未偵測到寵物</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] tabular-nums text-ink-soft/80">{formatTime(item.time)}</p>
                        <div className={`mx-auto my-2 flex h-11 w-11 items-center justify-center rounded-full ${moodColor(item.mood)}`}>
                          <MoodIcon mood={item.mood} size={20} />
                        </div>
                        <p className="text-xs font-bold text-pine-900">{item.mood}</p>
                        <p className="mt-1 text-[10px] text-ink-soft/80">{item.behavior}</p>
                        <p className="mt-1 text-[10px] text-ink-soft/60">活動量 {item.movement}</p>
                      </>
                    )}
                    {index < displayTimeline.length - 1 && (
                      <div className="absolute left-[87px] top-[39px] -z-0 h-[2px] w-[86px] bg-[#eae6d8]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasGap && (
            <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
              「無資料」表示該時段沒有偵測到寵物（例如不在鏡頭範圍內）。
              攝影機目前是否運作，請看鏡頭下方的狀態卡片；
              若攝影機或服務中斷，該時段同樣會顯示無資料。
            </p>
          )}
        </div>

        {/* 攝影機連線 */}
        <div className="flex items-center justify-center gap-2 pb-3">
          <span
            className={`h-2 w-2 rounded-full ${
              monitor.key === 'present' || monitor.key === 'absent'
                ? 'bg-pine-700'
                : monitor.key === 'camera_down'
                  ? 'bg-[#b4552f]'
                  : 'bg-ink-soft/60'
            }`}
          />
          <span className="text-xs text-ink-soft">
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
