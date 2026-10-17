import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  const stash = md => SLOT(slots.push(md) - 1)

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

  const applyName = (chunk, name, to) => {
    if (!chunk || chunk.startsWith('\u0000')) return chunk
    if (!chunk.includes(name)) return chunk
    return chunk.split(name).join(stash(`[${name}](${to})`))
  }

  for (const { name, to } of FEATURE_NAMES) {
    s = s.split(/(\u0000\d+\u0000)/).map(part => applyName(part, name, to)).join('')
  }

  s = s
    .split(/(\u0000\d+\u0000)/)
    .map(part => applyName(part, '通知', '/notifications'))
    .join('')

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

// ---------- 串流 ----------
// 預設走同網域的 /api（經 vercel.json 轉發）。如果發現文字不是逐字出現而是一次跳出來，
// 代表轉發層把串流緩衝住了：在前端專案設定 VITE_API_URL 為 API 網域即可直連。
const STREAM_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function streamChat(body, { signal, onStatus, onDelta, onReset }) {
  let res
  try {
    res = await fetch(`${STREAM_BASE}/api/assistant/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('paw-token')}`
      },
      body: JSON.stringify(body),
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

// ---------- 餵食確認卡 ----------
function FeedingCard({ action, status, error, onConfirm, onCancel }) {
  const needsAck = action.warnings?.some(w => w.requireAck)
  const closed = status === 'done' || status === 'cancelled'

  return (
    <div className="mt-1.5 w-[85%] rounded-2xl border border-green-200 bg-white p-3 text-sm shadow-sm">
      <p className="font-semibold text-gray-800">記錄餵食</p>

      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-gray-600">
        <dt>寵物</dt>
        <dd className="text-gray-800">{action.petName}</dd>
        <dt>食物</dt>
        <dd className="text-gray-800">{action.foodName}</dd>
        <dt>份量</dt>
        <dd className="text-gray-800">{action.amountG} g（約 {action.calories} kcal）</dd>
      </dl>

      {action.warnings?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {action.warnings.map((w, i) => (
            <li
              key={i}
              className={`rounded-lg px-2 py-1 text-xs ${
                w.level === 'warning'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-gray-50 text-gray-600'
              }`}
            >
              {w.title}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {status === 'done' && (
        <p className="mt-2 text-xs font-medium text-green-600">已記錄 ✓</p>
      )}
      {status === 'cancelled' && (
        <p className="mt-2 text-xs text-gray-400">已取消</p>
      )}

      {!closed && (
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={status === 'saving'}
            className="flex-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
          >
            {status === 'saving'
              ? '記錄中…'
              : needsAck
                ? '了解，仍要記錄'
                : '確認記錄'}
          </button>
          <button
            onClick={onCancel}
            disabled={status === 'saving'}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- 快速提問列：可橫向滑動 ----------
// 手機：手指滑動；電腦：滑鼠滾輪、按住拖曳都可以。兩側有漸層提示還有更多。
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

  // 滑鼠滾輪（上下滾）轉成橫向滑動
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

  // 滑鼠按住拖曳（觸控螢幕本來就能滑，不需要處理）
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
      // 等這次 click 事件過了再清掉，拖曳結束時才不會誤觸按鈕
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
    <div className="relative shrink-0 border-t border-gray-100 bg-white">
      <div
        ref={ref}
        onScroll={updateEdge}
        onMouseDown={onMouseDown}
        onClickCapture={onClickCapture}
        className="flex gap-1.5 overflow-x-auto px-3 pt-2.5 select-none cursor-grab active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(q => (
          <button
            key={q}
            onClick={() => onPick(q)}
            disabled={disabled}
            className="shrink-0 whitespace-nowrap text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-full px-3 py-1.5 transition-colors disabled:opacity-40 disabled:hover:bg-green-50"
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
  const [showPwaHint, setShowPwaHint] = useState(false)

  const dragRef = useRef(null)
  const movedRef = useRef(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

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

  // ---------- 傳送訊息（串流） ----------
  const send = async text => {
    const content = String(text ?? input).trim()
    if (!content || loading) return

    // 記住是哪隻寵物的對話：回答途中就算切換了寵物，內容也會寫回原本那份
    const key = chatKey
    const petForSend = activePetId

    const next = [...messages, { role: 'user', content }]
    const sid = `s${Date.now()}`

    updateChat(key, () => [
      ...next,
      { role: 'assistant', content: '', streaming: true, status: null, sid }
    ])
    setInput('')
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

    let streamed = ''

    try {
      let result

      try {
        result = await streamChat(payload, {
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
          const { data } = await api.post('/assistant/chat', payload, {
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
        streaming: false,
        status: null
      })
    } catch (err) {
      const aborted = err.name === 'AbortError' || err.code === 'ERR_CANCELED'

      if (aborted) {
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
    send(input)
  }

  // 站內連結：只允許已知功能路徑，擋掉 //example.com 這類外部網址
  const markdownComponents = {
    a: ({ href, children }) => {
      if (isInternalHref(href)) {
        return (
          <a
            href={href === '/notifications' || href === '/pwa-install' ? '#' : href}
            onClick={e => {
              e.preventDefault()
              goTo(href)
            }}
            className="text-green-600 underline underline-offset-2 font-medium hover:text-green-700"
          >
            {children}
          </a>
        )
      }
      return <span>{children}</span>
    }
  }

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
    ...new Set([...(PAGE_SUGGESTIONS[pageKey] || []), ...DEFAULT_SUGGESTIONS])
  ].slice(0, 6)

  if (hidden) return null

  return (
    <>
      {/* 收起時：可拖曳的圓形按鈕（手機開啟面板時隱藏，避免擋住面板） */}
      {!(open && isMobile) && (
        <button
          type="button"
          aria-label={hasAlert ? '開啟 PawCare 小助理（有新提醒）' : '開啟 PawCare 小助理'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragRef.current = null)}
          style={{ left: pos.x, top: pos.y, width: BALL, height: BALL, touchAction: 'none' }}
          className={`fixed z-30 rounded-full bg-green-500 text-white text-2xl shadow-lg shadow-green-500/30
            flex items-center justify-center select-none cursor-grab active:cursor-grabbing
            hover:bg-green-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600
            ${open ? 'ring-4 ring-green-200' : ''}`}
        >
          🐾
          {hasAlert && !open && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500" />
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
            className="sm:hidden fixed inset-0 z-40 bg-black/30"
          />

          <div
            role="dialog"
            aria-label="PawCare 小助理"
            style={panelStyle}
            className={`fixed z-40 bg-white border border-gray-200 shadow-2xl flex flex-col overflow-hidden
              ${isMobile ? 'inset-x-0 bottom-0 h-[80dvh] rounded-t-2xl' : 'rounded-2xl'}`}
          >
            {/* 標題列 */}
            <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-white">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shadow-sm">
                <span className="text-white text-base">🐾</span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">PawCare 小助理</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {pets.length > 1 && activePet
                    ? `與「${activePet.name}」的對話`
                    : '問我怎麼使用，或寵物照護小問題'}
                </p>
              </div>

              {pets.length > 1 && (
                <select
                  value={activePetId ?? ''}
                  onChange={e => switchPet(Number(e.target.value))}
                  aria-label="選擇寵物"
                  className="max-w-[6rem] truncate rounded-md border border-gray-200 bg-gray-50 px-1.5 py-1 text-xs text-gray-600 outline-none focus:border-green-400"
                >
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-100"
                >
                  清除
                </button>
              )}

              <button
                onClick={() => setOpen(false)}
                aria-label="關閉小助理"
                className="p-1.5 -mr-1 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* 對話內容 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
              {/* 歡迎訊息 */}
              <div className="flex">
                <div className="max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-gray-700 leading-relaxed">
                  <p>嗨！我是 PawCare 小助理 🐾</p>
                  <p className="mt-1">
                    可以問我怎麼使用各項功能、日常寵物照護的小問題，也能幫你查今天該餵什麼、記錄餵食。
                  </p>
                </div>
              </div>

              {/* 今日提醒（還沒開始聊天時顯示） */}
              {messages.length === 0 && briefingItems.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold text-gray-700">今日提醒</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {briefingItems.map(item => (
                      <li
                        key={item.id}
                        className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${
                          item.level === 'warning'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        <span className="flex-1">{item.text}</span>
                        {item.link && (
                          <button
                            onClick={() => goTo(item.link.to)}
                            className="shrink-0 font-medium text-green-700 hover:underline"
                          >
                            查看
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
                    <div className="max-w-[85%] bg-green-500 text-white rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col items-start">
                    <div
                      className={`max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed border break-words ${
                        m.isError
                          ? 'bg-red-50 border-red-100 text-red-600'
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      {m.isError ? (
                        m.content
                      ) : m.streaming && !m.content ? (
                        // 還沒有文字：顯示工具進度，或三個跳動的點
                        m.status ? (
                          <span className="text-gray-400">{m.status}</span>
                        ) : (
                          <span className="flex gap-1.5 py-1" aria-label="回覆中">
                            {[0, 1, 2].map(n => (
                              <span
                                key={n}
                                className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce"
                                style={{ animationDelay: `${n * 0.15}s` }}
                              />
                            ))}
                          </span>
                        )
                      ) : (
                        <div className="[&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold first:[&_p]:mt-0 last:[&_p]:mb-0">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {linkifyFeatureText(m.content)}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>

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
            <ChipRow items={suggestions} disabled={loading} onPick={send} />

            {/* 輸入列 */}
            <form
              onSubmit={handleSubmit}
              className="shrink-0 bg-white px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    // 中文輸入法選字時按 Enter 不該送出（Safari 的選字確認 keyCode 是 229）
                    if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
                      e.preventDefault()
                    }
                  }}
                  maxLength={MAX_INPUT}
                  placeholder="輸入問題，或說「剛餵了 50g 雞胸肉」"
                  className="flex-1 min-w-0 border border-gray-200 rounded-full px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all"
                />

                {loading ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="停止回答"
                    className="shrink-0 w-10 h-10 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center"
                  >
                    <span className="block w-3 h-3 rounded-sm bg-gray-600" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="送出"
                    className="shrink-0 w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:hover:bg-green-500 text-white flex items-center justify-center transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2 11 13" />
                      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                    </svg>
                  </button>
                )}
              </div>

              <p className="text-[10px] text-gray-300 text-center mt-2">
                AI 回答僅供參考，寵物健康問題請諮詢獸醫
              </p>
            </form>
          </div>
        </>
      )}
    </>
  )
}