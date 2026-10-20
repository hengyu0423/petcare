import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PawPrint, Sparkles, X, Send, Camera, Trash2, Square } from 'lucide-react'
import { api } from '../../lib/api'

// 這些頁面不顯示小助理（健康諮詢頁本身就是 AI 對話）
const HIDDEN_PATHS = ['/health-consult']

const BALL = 56
const MARGIN = 12
const POS_KEY = 'paw-assistant-pos'
const CHAT_KEY = 'paw-assistant-chats-v1' // { [petId]: messages[] }：每隻寵物各自一份對話
const PET_KEY = 'paw-assistant-pet'
const MAX_INPUT = 500

// 回覆裡提到的功能 → 可點擊跳轉（含沒有獨立頁面的通知設定、加到主畫面）
const FEATURE_PAGES = [
  { to: '/dashboard', names: ['主頁總覽'] },
  { to: '/pets', names: ['我的寵物'] },
  { to: '/diet', names: ['飲食管理'] },
  { to: '/health-consult', names: ['健康諮詢'] },
  { to: '/weekly-report', names: ['健康週報'] },
  { to: '/pet-cam', names: ['即時監控'] },
  { to: '/pet-emotion', names: ['AI 寵物心情辨識', '寵物心情辨識'] },
  { to: '/expenses', names: ['財務管理'] },
  { to: '/expense-report', names: ['支出報表'] },
  { to: '/food-database', names: ['食物資料庫'] },
  { to: '/community', names: ['社群'] },
  { to: '/notifications', names: ['通知設定'] },
  { to: '/pwa-install', names: ['手機使用', '加到主畫面'] }
]

const PATH_LABEL = Object.fromEntries(FEATURE_PAGES.map(f => [f.to, f.names[0]]))
PATH_LABEL['/notifications'] = '通知'

const FEATURE_NAMES = FEATURE_PAGES
  .flatMap(f => f.names.map(n => ({ name: n, to: f.to })))
  .sort((a, b) => b.name.length - a.name.length)

const SLOT = i => `\u0000${i}\u0000`

function isInternalHref(href) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
    return false
  }
  if (PATH_LABEL[href]) return true
  return /^\/pets\/[^/]+$/.test(href)
}

// 把「飲食管理（/diet）」或純文字功能名轉成 markdown 連結，已有的 [文字](/路徑) 會保留
function linkifyFeatureText(text) {
  if (!text) return text

  const slots = []
  // 記錄哪些頁面已經有連結：同一則回答裡，每個頁面最多再依名稱補一次，避免一行出現兩個連結
  const linkedTargets = new Set()
  const stash = md => {
    const target = /\]\(([^)]+)\)$/.exec(md)?.[1]
    if (target) linkedTargets.add(target)
    return SLOT(slots.push(md) - 1)
  }

  let s = String(text)

  // AI 常會寫「主頁總覽 [主頁總覽](/dashboard)」，先收成一個連結，避免畫面出現兩次名稱
  s = s.replace(
    /\*{0,2}([\u4e00-\u9fffA-Za-z0-9 ]{2,24})\*{0,2}\s*\[(\1)\]\((\/[-a-z0-9/]+)\)/g,
    '[$2]($3)'
  )
  s = s.replace(
    /\[([^\]]+)\]\((\/[-a-z0-9/]+)\)\s*\*{0,2}\1\*{0,2}/g,
    '[$1]($2)'
  )

  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, href) => {
    const h = String(href).trim()
    return isInternalHref(h) ? stash(`[${label}](${h})`) : label
  })

  s = s.replace(
    /([\u4e00-\u9fffA-Za-z0-9 ]{1,24})?[（(](\/[-a-z0-9/]+)[）)]/gi,
    (m, name, path) => {
      const href = path.replace(/\/+$/, '') || path
      if (!isInternalHref(href)) return m
      const label = (name || '').trim() || PATH_LABEL[href] || href
      return stash(`[${label}](${href})`)
    }
  )

  // 在還沒變成連結的文字裡，把第一個 name 換成連結；成功回傳 true
  const linkFirst = (name, to) => {
    let done = false
    s = s
      .split(/(\u0000\d+\u0000)/)
      .map(part => {
        if (done || !part || part.startsWith('\u0000')) return part
        const i = part.indexOf(name)
        if (i < 0) return part
        done = true
        return part.slice(0, i) + stash(`[${name}](${to})`) + part.slice(i + name.length)
      })
      .join('')
    return done
  }

  // 同一頁有多個名稱（手機使用／加到主畫面）時，取先出現的那個
  const candidates = FEATURE_NAMES
    .map(f => ({ ...f, pos: s.indexOf(f.name) }))
    .filter(f => f.pos >= 0)
    .sort((x, y) => x.pos - y.pos || y.name.length - x.name.length)

  for (const { name, to } of candidates) {
    if (!linkedTargets.has(to)) linkFirst(name, to)
  }

  // 「通知」是常見詞（例如「請立即通知獸醫」），只有「通知：…」這種功能說明才補成連結
  if (!linkedTargets.has('/notifications')) {
    let done = false
    s = s
      .split(/(\u0000\d+\u0000)/)
      .map(part => {
        if (done || part.startsWith('\u0000')) return part
        return part.replace(/通知(?=[：:])/, () => {
          done = true
          return stash('[通知](/notifications)')
        })
      })
      .join('')
  }

  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)])
}

function PwaInstallHint({ onClose }) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="pwa-hint-title"
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
      >
        <h2 id="pwa-hint-title" className="text-base font-bold text-gray-800">
          加到手機主畫面
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-gray-600 list-decimal pl-5">
          {isIOS ? (
            <>
              <li>用 Safari 開啟這個網站。</li>
              <li>點底下中間的「分享」按鈕。</li>
              <li>選「加入主畫面」，再按新增。</li>
            </>
          ) : (
            <>
              <li>用 Chrome 開啟這個網站。</li>
              <li>點右上角的「⋮」選單。</li>
              <li>選「加到主畫面」或「安裝應用程式」。</li>
            </>
          )}
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-green-500 py-2 text-sm font-medium text-white hover:bg-green-600"
        >
          知道了
        </button>
      </div>
    </div>
  )
}

// 快速提問：目前頁面專屬的排前面，再補上通用的（一直顯示在輸入框上方，可橫向滑動）
const PAGE_SUGGESTIONS = {
  '/diet': ['最近飲食有需要注意的嗎？', '飲食警訊是什麼？'],
  '/health-consult': ['什麼情況要馬上就醫？'],
  '/weekly-report': ['健康週報怎麼看？'],
  '/pet-cam': ['即時監控怎麼設定？'],
  '/expenses': ['怎麼記錄醫療支出？']
}
// 快速提問列最前面的「拍照」：點了不是送出文字，而是打開選照片
const PHOTO_CHIP = '📷 拍照問能不能吃'
const PHOTO_MAX_SIDE = 1024 // 送出前縮小到這個邊長以內（Vercel 函式的請求上限約 4.5MB，手機原圖常常超過）
const PHOTO_THUMB_SIDE = 160

const DEFAULT_SUGGESTIONS = [
  '今天可以餵什麼？',
  'PawCare 有哪些功能？',
  '怎麼新增寵物？',
  '怎麼加到手機主畫面？'
]

function clampPos(x, y) {
  const maxX = window.innerWidth - BALL - MARGIN
  const maxY = window.innerHeight - BALL - MARGIN
  return {
    x: Math.min(Math.max(MARGIN, x), maxX),
    y: Math.min(Math.max(MARGIN, y), maxY)
  }
}

function loadPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY))
    if (p) return clampPos(p.x, p.y)
  } catch { /* 忽略 */ }
  // 預設：右下角，避開手機底部
  return clampPos(Infinity, window.innerHeight - BALL - 96)
}

function loadChats() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CHAT_KEY))
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved
  } catch { /* 忽略 */ }
  return {}
}

function loadPetId() {
  const n = Number(sessionStorage.getItem(PET_KEY))
  return Number.isFinite(n) && n > 0 ? n : null
}

// ---------- 食物照片：縮小、轉成 JPEG ----------
async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try {
      return await window.createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      try {
        return await window.createImageBitmap(file)
      } catch { /* 改用 Image 後備 */ }
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('decode'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 回傳 { blob, thumb, previewUrl }；讀不到圖片時丟出帶有中文說明的錯誤
async function preparePhoto(file) {
  if (!file || !String(file.type).startsWith('image/')) {
    throw new Error('請選擇圖片檔案（JPG、PNG、WebP）')
  }

  let bitmap
  try {
    bitmap = await loadBitmap(file)
  } catch {
    throw new Error('讀不到這張照片，請換一張試試')
  }

  const draw = side => {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('這個瀏覽器無法處理照片')
    ctx.fillStyle = '#ffffff' // PNG 的透明處轉成 JPEG 會變黑，先鋪白底
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas
  }
  const toBlob = (canvas, quality) =>
    new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))

  try {
    const canvas = draw(PHOTO_MAX_SIDE)
    let blob = await toBlob(canvas, 0.82)
    if (blob && blob.size > 2.5 * 1024 * 1024) blob = await toBlob(canvas, 0.6)
    if (!blob) throw new Error('這個瀏覽器無法處理照片')

    const thumb = draw(PHOTO_THUMB_SIDE).toDataURL('image/jpeg', 0.7)
    return { blob, thumb, previewUrl: URL.createObjectURL(blob) }
  } finally {
    bitmap.close?.()
  }
}

// ---------- 串流 ----------
// 預設走同網域的 /api（經 vercel.json 轉發）。如果發現文字不是逐字出現而是一次跳出來，
// 代表轉發層把串流緩衝住了：在前端專案設定 VITE_API_URL 為 API 網域即可直連。
const STREAM_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function streamChat(body, { signal, onStatus, onDelta, onReset }) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  let res
  try {
    res = await fetch(`${STREAM_BASE}/api/assistant/chat/stream`, {
      method: 'POST',
      headers: {
        // 帶照片時是 FormData，Content-Type（含 boundary）要交給瀏覽器自己設
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${localStorage.getItem('paw-token')}`
      },
      body: isForm ? body : JSON.stringify(body),
      signal
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    const e = new Error('連線失敗，請稍後再試。')
    e.fallback = true // 連不上串流端點，改用一次回完的版本再試
    throw e
  }

  // 與 lib/api.js 的 401 處理一致
  if (res.status === 401) {
    localStorage.removeItem('paw-token')
    localStorage.removeItem('paw-user')
    window.location.href = '/login'
    throw new Error('登入已過期')
  }

  const isSSE = res.headers.get('content-type')?.includes('text/event-stream')

  if (!res.ok || !isSSE) {
    const json = await res.json().catch(() => null)
    const e = new Error(json?.error || '連線失敗，請稍後再試。')
    e.fallback = !json?.error // 有明確錯誤訊息就直接顯示；否則（例如代理回了 HTML）改走退路
    throw e
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let result = null

  const dispatch = (event, data) => {
    if (event === 'status') onStatus?.(data.text)
    else if (event === 'delta') onDelta?.(data.text)
    else if (event === 'reset') onReset?.()
    else if (event === 'done') result = data
    else if (event === 'error') throw new Error(data.error || '連線失敗，請稍後再試。')
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, idx)
      buf = buf.slice(idx + 2)

      let event = 'message'
      let dataLine = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLine += line.slice(5).trim()
      }
      if (!dataLine) continue // 心跳註解（: ping）
      dispatch(event, JSON.parse(dataLine))
    }
  }

  if (!result) {
    const e = new Error('回答中斷')
    e.fallback = true
    throw e
  }
  return result
}

// ---------- 食物照片的結論卡片 ----------
// 結論（verdict）由後端規則決定（危險食物、健康歷史、近期飲食…），不是 AI 自己說了算。
const VERDICTS = {
  avoid: { label: '不建議餵食', box: 'border-red-300 bg-red-50/70', pill: 'bg-red-500 text-white font-mono' },
  caution: { label: '少量給予・注意觀察', box: 'border-amber-300 bg-amber-50/70', pill: 'bg-amber-400 text-[#191919] font-mono font-bold' },
  ok: { label: '安全無虞・可正常食用', box: 'border-[#191919] bg-white', pill: 'bg-[#fffa00] text-[#191919] font-mono font-bold border border-[#191919]' },
  unknown: { label: '僅完成辨識・待確認', box: 'border-[#e5e5e5] bg-[#fafafa]', pill: 'bg-[#8a8a8a] text-white font-mono' }
}

function FoodPhotoCard({ photo }) {
  const v = VERDICTS[photo.verdict] || VERDICTS.unknown
  const n = photo.nutrition || {}
  const hasNutrition = Number(n.kcal) > 0

  return (
    <div className={`mt-2 w-[90%] border p-3 text-sm ${v.box}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-[#8a8a8a]">
            {photo.petName && photo.checked ? `// TARGET: ${photo.petName}` : '// FOOD_RECOGNITION'}
          </p>
          <p className="font-bold text-[#191919] break-words">{photo.name}</p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-[11px] ${v.pill}`}>
          {v.label}
        </span>
      </div>

      <p className="mt-1.5 text-xs font-mono text-[#555]">
        {hasNutrition
          ? `每 100g 約 ${n.kcal} kcal // 蛋白質 ${n.protein}g // 脂肪 ${n.fat}g // 碳水 ${n.carb}g`
          : '營養成份資料待補齊'}
      </p>

      {photo.warnings?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {photo.warnings.map((w, i) => (
            <li
              key={i}
              className={`px-2 py-1 text-xs font-mono border ${
                w.level === 'danger'
                  ? 'bg-red-100 text-red-900 border-red-300'
                  : w.level === 'warning'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-[#555] border-[#e5e5e5]'
              }`}
            >
              [!] {w.title}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[10px] font-mono text-[#8a8a8a]">
        // 辨識結果僅供參考，餵食前請確認食物安全與毛孩體質。
      </p>
    </div>
  )
}

// ---------- 餵食確認卡 ----------
function FeedingCard({ action, status, error, onConfirm, onCancel }) {
  const needsAck = action.warnings?.some(w => w.requireAck)
  const closed = status === 'done' || status === 'cancelled'

  return (
    <div className="mt-2 w-[90%] border border-[#191919] bg-white p-3 text-sm shadow-xs font-sans">
      <div className="text-[10px] font-mono font-bold tracking-wider text-[#191919] mb-1">
        // FEEDING_CONFIRMATION
      </div>
      <p className="font-bold text-[#191919]">記錄餵食項目</p>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono text-[#555]">
        <dt>目標寵物:</dt>
        <dd className="font-bold text-[#191919]">{action.petName}</dd>
        <dt>指定品項:</dt>
        <dd className="font-bold text-[#191919]">{action.foodName}</dd>
        <dt>給予份量:</dt>
        <dd className="font-bold text-[#191919]">{action.amountG} g (約 {action.calories} kcal)</dd>
      </dl>

      {action.warnings?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {action.warnings.map((w, i) => (
            <li
              key={i}
              className={`px-2 py-1 text-xs font-mono border ${
                w.level === 'warning'
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-[#fafafa] text-[#555] border-[#e5e5e5]'
              }`}
            >
              [!] {w.title}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs font-mono text-red-500">[ERROR] {error}</p>}

      {status === 'done' && (
        <p className="mt-2 text-xs font-mono font-bold text-[#191919] bg-[#fffa00] px-2 py-1 border border-[#191919] inline-block">
          ✓ 已成功登記餵食
        </p>
      )}
      {status === 'cancelled' && (
        <p className="mt-2 text-xs font-mono text-[#8a8a8a]">已取消登記作業</p>
      )}

      {!closed && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={status === 'saving'}
            className="flex-1 border border-[#191919] bg-[#fffa00] px-3 py-1.5 text-xs font-mono font-bold text-[#191919] hover:bg-black hover:text-[#fffa00] transition-colors disabled:opacity-50"
          >
            {status === 'saving'
              ? '處理中...'
              : needsAck
                ? '確認並強制記錄'
                : '確認記錄'}
          </button>
          <button
            onClick={onCancel}
            disabled={status === 'saving'}
            className="border border-[#d9d9d9] bg-white px-3 py-1.5 text-xs font-mono text-[#555] hover:border-[#191919] hover:text-[#191919] transition-colors disabled:opacity-50"
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- 快速提問列：可橫向滑動 ----------
function ChipRow({ items, disabled, onPick }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const [edge, setEdge] = useState({ left: false, right: false })

  const updateEdge = () => {
    const el = ref.current
    if (!el) return
    setEdge({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    })
  }

  useEffect(() => {
    updateEdge()
  }, [items])

  useEffect(() => {
    window.addEventListener('resize', updateEdge)
    return () => window.removeEventListener('resize', updateEdge)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = e => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onMouseDown = e => {
    if (e.button !== 0) return
    const el = ref.current
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false }

    const move = ev => {
      const d = drag.current
      if (!d) return
      const dx = ev.clientX - d.x
      if (Math.abs(dx) > 5) d.moved = true
      if (d.moved) el.scrollLeft = d.left - dx
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      setTimeout(() => {
        drag.current = null
      }, 0)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const onClickCapture = e => {
    if (drag.current?.moved) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div className="relative shrink-0 border-t border-[#f0f0f0] bg-white">
      <div
        ref={ref}
        onScroll={updateEdge}
        onMouseDown={onMouseDown}
        onClickCapture={onClickCapture}
        className="flex gap-1.5 overflow-x-auto px-3 py-2 select-none cursor-grab active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(q => (
          <button
            key={q}
            onClick={() => onPick(q)}
            disabled={disabled}
            className="shrink-0 whitespace-nowrap text-xs font-mono font-medium text-[#191919] bg-[#fafafa] hover:bg-[#fffa00] border border-[#d9d9d9] hover:border-[#191919] px-2.5 py-1 transition-colors disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {edge.left && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent"
        />
      )}
      {edge.right && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
        />
      )}
    </div>
  )
}

// ======================================================
// 主元件
// ======================================================

export default function AssistantWidget() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const queryClient = useQueryClient()

  const hidden = HIDDEN_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`)
  )

  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(loadPos)
  const [vw, setVw] = useState(window.innerWidth)
  const [chats, setChats] = useState(loadChats) // { [petId]: [{ role, content, isError?, pendingAction?, ... }] }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [petId, setPetId] = useState(loadPetId)
  const [photo, setPhoto] = useState(null) // 準備隨下一則訊息送出的照片 { blob, thumb, previewUrl }
  const [photoError, setPhotoError] = useState('')
  const [showPwaHint, setShowPwaHint] = useState(false)

  const dragRef = useRef(null)
  const movedRef = useRef(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const fileInputRef = useRef(null)

  const { data: pets = [] } = useQuery({
    queryKey: ['assistant-pets'],
    queryFn: async () => (await api.get('/pets')).data.data,
    staleTime: 60_000
  })
  const activePet = pets.find(p => p.id === petId) ?? pets[0] ?? null
  const activePetId = activePet?.id ?? null

  // 每隻寵物各自一份對話；沒有寵物時用 'none'
  const chatKey = String(activePetId ?? 'none')
  const messages = chats[chatKey] || []
  const updateChat = (key, fn) =>
    setChats(c => ({ ...c, [key]: fn(c[key] || []) }))

  // 主動提醒：不吃 AI 額度，每 5 分鐘更新一次
  const { data: briefing } = useQuery({
    queryKey: ['assistant-briefing', activePetId],
    queryFn: async () =>
      (await api.get('/assistant/briefing', { params: { petId: activePetId } }))
        .data.data,
    enabled: !!activePetId && !hidden,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000
  })
  const briefingItems = briefing?.items || []
  const hasAlert = briefingItems.some(i => i.level === 'warning')

  const isMobile = vw < 640

  // 進入隱藏頁面時把視窗收起來（對話內容保留，離開後還能接著聊）
  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  // 視窗大小改變時，把球拉回畫面內
  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth)
      setPos(p => clampPos(p.x, p.y))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 對話暫存（換頁不會掉，重新整理後仍保留到關閉分頁）；還在輸出中的訊息不存
  useEffect(() => {
    const toSave = Object.fromEntries(
      Object.entries(chats).map(([k, ms]) => [
        k,
        ms.filter(m => !m.streaming).slice(-30)
      ])
    )
    sessionStorage.setItem(CHAT_KEY, JSON.stringify(toSave))
  }, [chats])

  // 記住目前選的寵物
  useEffect(() => {
    if (activePetId != null) sessionStorage.setItem(PET_KEY, String(activePetId))
  }, [activePetId])

  // 寵物被刪除後，順便清掉那隻的對話
  useEffect(() => {
    if (!pets.length) return
    const valid = new Set(pets.map(p => String(p.id)))
    valid.add('none')
    setChats(c =>
      Object.keys(c).every(k => valid.has(k))
        ? c
        : Object.fromEntries(Object.entries(c).filter(([k]) => valid.has(k)))
    )
  }, [pets])

  // 登出或離開時中止還沒完成的回答
  useEffect(() => () => abortRef.current?.abort(), [])

  // 離開時釋放還沒送出的照片預覽
  const photoRef = useRef(null)
  photoRef.current = photo
  useEffect(
    () => () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.previewUrl)
    },
    []
  )

  // 新訊息出現時捲到最底
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, open])

  // 按 Esc 關閉
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // 電腦版開啟時自動聚焦輸入框（手機不聚焦，避免鍵盤一下子蓋住畫面）
  useEffect(() => {
    if (open && window.matchMedia?.('(min-width: 640px)').matches) {
      inputRef.current?.focus()
    }
  }, [open])

  // ---------- 拖曳 ----------
  const onPointerDown = e => {
    movedRef.current = false
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = e => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 5) movedRef.current = true
    if (movedRef.current) setPos(clampPos(d.ox + dx, d.oy + dy))
  }
  const onPointerUp = () => {
    if (!dragRef.current) return
    dragRef.current = null
    if (!movedRef.current) {
      setOpen(true)
      return
    }
    // 放開後吸附到最近的左右邊
    setPos(p => {
      const snapped = clampPos(
        p.x + BALL / 2 < window.innerWidth / 2 ? 0 : Infinity,
        p.y
      )
      localStorage.setItem(POS_KEY, JSON.stringify(snapped))
      return snapped
    })
  }

  // ---------- 食物照片 ----------
  const openPicker = () => {
    if (!loading) fileInputRef.current?.click()
  }

  const removePhoto = () => {
    setPhoto(old => {
      if (old) URL.revokeObjectURL(old.previewUrl)
      return null
    })
    setPhotoError('')
  }

  const onPickFile = async e => {
    const file = e.target.files?.[0]
    e.target.value = '' // 讓同一張照片可以重新選
    if (!file) return

    try {
      const prepared = await preparePhoto(file)
      setPhoto(old => {
        if (old) URL.revokeObjectURL(old.previewUrl)
        return prepared
      })
      setPhotoError('')
    } catch (err) {
      setPhotoError(err.message || '讀不到這張照片，請換一張試試')
    }
  }

  // ---------- 傳送訊息（串流） ----------
  const send = async text => {
    const fromInput = text == null // 是自己打的字（不是點建議按鈕）
    const typed = String(text ?? input).trim()
    const attached = photo
    // 只傳照片、沒打字時，用一句預設的問題
    const content =
      typed ||
      (attached
        ? activePet
          ? `這個可以給 ${activePet.name} 吃嗎？`
          : '這個可以給寵物吃嗎？'
        : '')
    if (!content || loading) return

    // 記住是哪隻寵物的對話：回答途中就算切換了寵物，內容也會寫回原本那份
    const key = chatKey
    const petForSend = activePetId

    const next = [
      ...messages,
      { role: 'user', content, ...(attached ? { thumb: attached.thumb } : {}) }
    ]
    const sid = `s${Date.now()}`

    updateChat(key, () => [
      ...next,
      { role: 'assistant', content: '', streaming: true, status: null, sid }
    ])
    setInput('')
    setPhoto(null) // 預覽先收起來；失敗時下面會放回去（照片的網址等結束後才釋放）
    setPhotoError('')
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    const patch = p =>
      updateChat(key, ms => ms.map(m => (m.sid === sid ? { ...m, ...p } : m)))

    // 錯誤訊息只是顯示用，不送給 AI
    const payload = {
      messages: next
        .filter(m => !m.isError)
        .map(({ role, content }) => ({ role, content })),
      petId: petForSend,
      page: pathname
    }

    // 有照片時改用 multipart：照片 + payload（JSON）
    let body = payload
    if (attached) {
      body = new FormData()
      body.append('image', attached.blob, 'photo.jpg')
      body.append('payload', JSON.stringify(payload))
    }

    let streamed = ''
    let restorePhoto = false // 還沒拿到任何回答就失敗／中止：把照片放回去，不用重拍

    try {
      let result

      try {
        result = await streamChat(body, {
          signal: controller.signal,
          onStatus: s => patch({ status: s }),
          onDelta: t => {
            streamed += t
            patch({ content: streamed, status: null })
          },
          onReset: () => {
            streamed = ''
            patch({ content: '', status: null })
          }
        })
      } catch (err) {
        // 串流連不上或被中間層擋掉，而且還沒出現任何文字 → 改用一次回完的版本
        if (err.fallback && !streamed) {
          const { data } = await api.post('/assistant/chat', body, {
            signal: controller.signal
          })
          if (!data.success) throw new Error(data.error || '小助理暫時無法回答')
          result = data.data
        } else {
          throw err
        }
      }

      patch({
        content: result.reply,
        pendingAction: result.pendingAction || null,
        foodPhoto: result.foodPhoto || null,
        streaming: false,
        status: null
      })
    } catch (err) {
      const aborted = err.name === 'AbortError' || err.code === 'ERR_CANCELED'

      if (aborted) {
        restorePhoto = !streamed
        // 使用者按了停止（或切換了寵物）：保留已經出現的文字，沒有文字就拿掉這則
        updateChat(key, ms =>
          streamed
            ? ms.map(m =>
                m.sid === sid
                  ? { ...m, content: streamed, streaming: false, status: null }
                  : m
              )
            : ms.filter(m => m.sid !== sid)
        )
      } else if (streamed) {
        patch({
          content: `${streamed}\n\n（回答中斷）`,
          streaming: false,
          status: null
        })
      } else {
        restorePhoto = true
        patch({
          content:
            err.response?.data?.error ||
            err.message ||
            '小助理暫時無法回答，請稍後再試',
          isError: true,
          streaming: false,
          status: null
        })
      }
    } finally {
      setLoading(false)
      abortRef.current = null

      if (attached) {
        if (restorePhoto) {
          // 照片和打的字一起放回去，使用者直接再按一次送出就好
          setPhoto(old => old ?? attached)
          if (fromInput && typed) setInput(cur => cur || typed)
        } else {
          URL.revokeObjectURL(attached.previewUrl)
        }
      }
    }
  }

  const stop = () => abortRef.current?.abort()

  // ---------- 確認卡 ----------
  const patchMsg = (idx, patch) =>
    updateChat(chatKey, ms => ms.map((m, i) => (i === idx ? { ...m, ...patch } : m)))

  const confirmAction = async idx => {
    const m = messages[idx]
    if (!m?.pendingAction || m.actionStatus === 'saving') return

    patchMsg(idx, { actionStatus: 'saving', actionError: null })

    try {
      await api.post('/assistant/confirm-feeding', {
        token: m.pendingAction.token
      })
      patchMsg(idx, { actionStatus: 'done' })
      // 讓飲食頁面、提醒等資料立刻更新
      queryClient.invalidateQueries()
    } catch (err) {
      patchMsg(idx, {
        actionStatus: null,
        actionError: err.response?.data?.error || '記錄失敗，請稍後再試'
      })
    }
  }

  const goTo = path => {
    if (path === '/notifications') {
      if (isMobile) setOpen(false)
      window.dispatchEvent(new Event('paw:open-notification-settings'))
      return
    }
    if (path === '/pwa-install') {
      setShowPwaHint(true)
      return
    }
    navigate(path)
    // 手機上視窗佔滿下半部，跳轉後收起來才看得到頁面
    if (isMobile) setOpen(false)
  }

  // 只清掉目前這隻寵物的對話
  const clearChat = () => {
    abortRef.current?.abort()
    updateChat(chatKey, () => [])
  }

  // 切換寵物：換成那隻自己的對話；還在輸出的回答先停掉（已出現的文字會留在原本那份）
  const switchPet = id => {
    abortRef.current?.abort()
    setPetId(id)
  }

  const handleSubmit = e => {
    e.preventDefault()
    send() // 不帶參數：表示內容來自輸入框（建議按鈕才會帶文字）
  }

  // 站內連結：只允許已知功能路徑，擋掉 //example.com 這類外部網址。
  // 用 ref 拿最新的 goTo，讓 components 物件保持不變——否則每次渲染（串流時每個字都會）
  // 都會把所有連結整個卸載重建，造成閃爍，也讓 hover／點擊中的連結失效。
  const goToRef = useRef(goTo)
  goToRef.current = goTo

  const markdownComponents = useMemo(
    () => ({
      a: ({ href, children }) => {
        if (isInternalHref(href)) {
          return (
            <a
              href={href === '/notifications' || href === '/pwa-install' ? '#' : href}
              onClick={e => {
                e.preventDefault()
                goToRef.current(href)
              }}
              className="text-green-600 underline underline-offset-2 font-medium hover:text-green-700"
            >
              {children}
            </a>
          )
        }
        return <span>{children}</span>
      }
    }),
    []
  )

  // ---------- 面板位置（電腦版：跟著球走；手機版：底部抽屜） ----------
  const PANEL_W = 380
  const PANEL_H = 560
  const panelStyle = isMobile
    ? undefined
    : {
        width: PANEL_W,
        height: Math.min(PANEL_H, window.innerHeight - MARGIN * 2),
        left: Math.min(
          Math.max(MARGIN, pos.x + BALL - PANEL_W),
          window.innerWidth - PANEL_W - MARGIN
        ),
        top:
          pos.y > PANEL_H + MARGIN * 2
            ? pos.y - PANEL_H - 8
            : Math.max(
                MARGIN,
                Math.min(pos.y + BALL + 8, window.innerHeight - PANEL_H - MARGIN)
              )
      }

  const pageKey = Object.keys(PAGE_SUGGESTIONS).find(k => pathname.startsWith(k))
  const suggestions = [
    PHOTO_CHIP,
    ...new Set([...(PAGE_SUGGESTIONS[pageKey] || []), ...DEFAULT_SUGGESTIONS])
  ].slice(0, 6)

  if (hidden) return null

  return (
    <>
      {/* 收起時：可拖曳的 Endfield 工業風格按鈕 */}
      {!(open && isMobile) && (
        <button
          type="button"
          aria-label={hasAlert ? '開啟 PawCare 小助理（有新提醒）' : '開啟 PawCare 小助理'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragRef.current = null)}
          style={{ left: pos.x, top: pos.y, width: BALL, height: BALL, touchAction: 'none' }}
          className={`fixed z-30 bg-[#191919] border border-[#191919] text-[#fffa00] shadow-2xl
            flex items-center justify-center select-none cursor-grab active:cursor-grabbing
            hover:bg-black transition-transform active:scale-95 focus-visible:outline-hidden
            ${open ? 'ring-2 ring-[#fffa00]' : ''}`}
        >
          <PawPrint size={24} strokeWidth={2.2} />
          <div className="absolute top-0 right-0 w-2 h-2 bg-[#fffa00]" />
          {hasAlert && !open && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-[#fffa00] border-2 border-[#191919]" />
          )}
        </button>
      )}

      {showPwaHint && <PwaInstallHint onClose={() => setShowPwaHint(false)} />}

      {open && (
        <>
          {/* 手機的半透明背景，點一下收起 */}
          <div
            onClick={() => setOpen(false)}
            aria-hidden="true"
            className="sm:hidden fixed inset-0 z-40 bg-[#000000]/40"
          />

          <div
            role="dialog"
            aria-label="PawCare 小助理"
            data-theme="light"
            style={panelStyle}
            className={`fixed z-40 bg-white border border-[#191919] shadow-2xl flex flex-col overflow-hidden
              ${isMobile ? 'inset-x-0 bottom-0 h-[80dvh]' : ''}`}
          >
            {/* 標題列 */}
            <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-[#e5e5e5] bg-[#fafafa]">
              <div className="w-7 h-7 bg-[#191919] text-[#fffa00] border border-[#191919] flex items-center justify-center shrink-0">
                <PawPrint size={15} strokeWidth={2.2} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#191919] font-mono tracking-wider">PAWCARE // ASSISTANT</p>
                <p className="text-[10px] text-[#8a8a8a] truncate font-mono">
                  {pets.length > 1 && activePet
                    ? `對話寵物：${activePet.name}`
                    : '日常照護、餵食查詢與照片諮詢'}
                </p>
              </div>

              {pets.length > 1 && (
                <select
                  value={activePetId ?? ''}
                  onChange={e => switchPet(Number(e.target.value))}
                  aria-label="選擇寵物"
                  className="max-w-[5.5rem] truncate border border-[#d9d9d9] bg-white px-1.5 py-1 text-[11px] font-mono text-[#191919] outline-hidden focus:border-[#191919]"
                >
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-[11px] font-mono text-[#8a8a8a] hover:text-[#dc2626] px-1.5 py-1 border border-transparent hover:border-[#dc2626] transition-colors"
                >
                  清除
                </button>
              )}

              <button
                onClick={() => setOpen(false)}
                aria-label="關閉小助理"
                className="w-7 h-7 flex items-center justify-center border border-[#e5e5e5] text-[#8a8a8a] hover:text-[#191919] hover:border-[#191919] transition-colors ml-1"
              >
                <X size={14} />
              </button>
            </div>

            {/* 對話內容 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#fafafa]">
              {/* 歡迎訊息 */}
              <div className="flex">
                <div className="max-w-[85%] bg-white border-l-2 border-[#fffa00] border-y border-r border-[#e5e5e5] p-3 text-xs leading-relaxed text-[#191919] shadow-xs">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-[#191919] text-[11px] mb-1">
                    <PawPrint size={13} className="text-[#191919]" />
                    <span>PAWCARE_ASSISTANT</span>
                  </div>
                  <p>
                    你好！我是 PawCare 寵物照護助理。可以詢問系統各項功能、日常飼育建議，或拍照快速辨識毛孩食物與營養成分。
                  </p>
                </div>
              </div>

              {/* 今日提醒（還沒開始聊天時顯示） */}
              {messages.length === 0 && briefingItems.length > 0 && (
                <div className="border border-[#191919] bg-white p-3 shadow-xs">
                  <div className="text-[10px] font-mono font-bold tracking-wider text-[#191919] mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#fffa00] border border-[#191919]" />
                    TODAY_REMINDERS
                  </div>
                  <ul className="space-y-1.5">
                    {briefingItems.map(item => (
                      <li
                        key={item.id}
                        className={`flex items-start gap-2 px-2.5 py-1.5 text-xs font-mono border ${
                          item.level === 'warning'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-[#fafafa] text-[#555] border-[#e5e5e5]'
                        }`}
                      >
                        <span className="flex-1">{item.text}</span>
                        {item.link && (
                          <button
                            onClick={() => goTo(item.link.to)}
                            className="shrink-0 font-bold text-[#191919] hover:underline"
                          >
                            [查看]
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] bg-[#191919] text-[#fffa00] border border-[#191919] px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words font-sans">
                      {m.thumb && (
                        <img
                          src={m.thumb}
                          alt="已傳送的食物照片"
                          className="mb-2 h-28 w-28 object-cover border border-[#444]"
                        />
                      )}
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col items-start">
                    <div
                      className={`max-w-[88%] border px-3.5 py-2.5 text-xs leading-relaxed break-words shadow-xs ${
                        m.isError
                          ? 'bg-red-50 border-red-300 text-red-700 font-mono'
                          : 'bg-white border-[#e5e5e5] text-[#191919]'
                      }`}
                    >
                      {m.isError ? (
                        m.content
                      ) : m.streaming && !m.content ? (
                        m.status ? (
                          <span className="font-mono text-[11px] text-[#8a8a8a]">{m.status}</span>
                        ) : (
                          <span className="flex items-center gap-1.5 py-1" aria-label="回覆中">
                            {[0, 1, 2].map(n => (
                              <span
                                key={n}
                                className="w-1.5 h-1.5 bg-[#191919] animate-bounce"
                                style={{ animationDelay: `${n * 0.15}s` }}
                              />
                            ))}
                          </span>
                        )
                      ) : (
                        <div className="[&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-bold first:[&_p]:mt-0 last:[&_p]:mb-0">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {linkifyFeatureText(m.content)}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {m.foodPhoto?.ok && <FoodPhotoCard photo={m.foodPhoto} />}

                    {m.pendingAction && (
                      <FeedingCard
                        action={m.pendingAction}
                        status={m.actionStatus}
                        error={m.actionError}
                        onConfirm={() => confirmAction(i)}
                        onCancel={() => patchMsg(i, { actionStatus: 'cancelled' })}
                      />
                    )}
                  </div>
                )
              )}

              <div ref={endRef} />
            </div>

            {/* 快速提問：一直都在，點一下直接送出；可橫向滑動 */}
            <ChipRow
              items={suggestions}
              disabled={loading}
              onPick={q => (q === PHOTO_CHIP ? openPicker() : send(q))}
            />

            {/* 準備傳送的照片 */}
            {(photo || photoError) && (
              <div className="shrink-0 bg-white px-3 pt-2">
                {photo && (
                  <div className="flex items-center gap-2 border border-[#191919] bg-[#fafafa] p-1.5">
                    <img
                      src={photo.thumb}
                      alt="準備傳送的食物照片"
                      className="h-12 w-12 shrink-0 object-cover border border-[#d9d9d9]"
                    />
                    <p className="min-w-0 flex-1 text-xs font-mono text-[#191919]">
                      傳送後將自動進行食材辨識與安全評估{activePet ? ` (${activePet.name})` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={removePhoto}
                      aria-label="移除照片"
                      className="shrink-0 p-1.5 text-[#8a8a8a] hover:text-red-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {photoError && (
                  <p role="alert" className="mt-1 text-xs font-mono text-red-500">
                    [ERROR] {photoError}
                  </p>
                )}
              </div>
            )}

            {/* 輸入列 */}
            <form
              onSubmit={handleSubmit}
              className="shrink-0 bg-white px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 border-t border-[#f0f0f0]"
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={loading}
                  aria-label="選擇食物照片"
                  className="shrink-0 w-9 h-9 border border-[#d9d9d9] hover:border-[#191919] bg-white text-[#191919] hover:bg-[#fafafa] flex items-center justify-center transition-colors disabled:opacity-40"
                >
                  <Camera size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFile}
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
                      e.preventDefault()
                    }
                  }}
                  maxLength={MAX_INPUT}
                  placeholder="輸入問題，或點左側相機拍照..."
                  className="flex-1 min-w-0 border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-xs text-[#191919] focus:outline-hidden focus:border-[#191919] focus:bg-white transition-colors placeholder:text-[#8a8a8a]"
                />

                {loading ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="停止回答"
                    className="shrink-0 w-9 h-9 border border-[#191919] bg-[#191919] text-[#fffa00] hover:opacity-90 flex items-center justify-center transition-colors"
                  >
                    <Square size={13} className="fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim() && !photo}
                    aria-label="送出"
                    className="shrink-0 w-9 h-9 border border-[#191919] bg-[#fffa00] text-[#191919] hover:bg-black hover:text-[#fffa00] flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-[#fffa00] disabled:hover:text-[#191919]"
                  >
                    <Send size={15} />
                  </button>
                )}
              </div>

              <p className="text-[10px] font-mono text-[#8a8a8a] text-center mt-2">
                // AI 回答僅供參考，若遇緊急醫療需求請諮詢專業獸醫師
              </p>
            </form>
          </div>
        </>
      )}
    </>
  )
}