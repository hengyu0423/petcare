import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

// 這些頁面不顯示小助理（健康諮詢頁本身就是 AI 對話）
const HIDDEN_PATHS = ['/health-consult']

const SUGGESTIONS = [
  'PawCare 有哪些功能？',
  '怎麼新增寵物？',
  '飲食警訊是什麼？',
  '怎麼加到手機主畫面？'
]

const MAX_INPUT = 500

// ======================================================
// 簡易文字格式：**粗體**、- 條列、[文字](/站內路徑)
// 不使用 dangerouslySetInnerHTML，全部以 React 元素輸出，避免 XSS
// ======================================================

function renderInline(text, onLink) {
  const parts = []
  const regex = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*/g

  let last = 0
  let key = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))

    if (match[1]) {
      const path = match[2]

      // 只允許站內連結，擋掉 //example.com 這類外部網址
      if (path.startsWith('//')) {
        parts.push(match[1])
      } else {
        parts.push(
          <a
            key={key++}
            href={path}
            onClick={e => {
              e.preventDefault()
              onLink(path)
            }}
            className="text-green-600 underline underline-offset-2 font-medium hover:text-green-700"
          >
            {match[1]}
          </a>
        )
      }
    } else {
      parts.push(<strong key={key++}>{match[3]}</strong>)
    }

    last = regex.lastIndex
  }

  if (last < text.length) parts.push(text.slice(last))

  return parts
}

function MessageText({ text, onLink }) {
  const blocks = []
  let list = []

  const flush = () => {
    if (list.length) {
      blocks.push({ type: 'ul', items: list })
      list = []
    }
  }

  for (const line of String(text).split('\n')) {
    const bullet = line.match(/^\s*[-•]\s+(.*)$/)

    if (bullet) {
      list.push(bullet[1])
    } else {
      flush()
      if (line.trim()) blocks.push({ type: 'p', text: line })
    }
  }

  flush()

  return (
    <div className="space-y-1.5 break-words">
      {blocks.map((block, i) =>
        block.type === 'ul' ? (
          <ul key={i} className="list-disc pl-4 space-y-0.5">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, onLink)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{renderInline(block.text, onLink)}</p>
        )
      )}
    </div>
  )
}

// ======================================================
// 主元件
// ======================================================

export default function AssistantWidget() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([]) // { role, content, error? }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const endRef = useRef(null)
  const inputRef = useRef(null)

  const hidden = HIDDEN_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`)
  )

  // 進入隱藏頁面時順便把視窗收起來（對話內容保留，離開後還能接著聊）
  const [prevHidden, setPrevHidden] = useState(hidden)
  if (hidden !== prevHidden) {
    setPrevHidden(hidden)
    if (hidden) setOpen(false)
  }

  // 新訊息出現時捲到最底
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading, open])

  // 按 Esc 關閉
  useEffect(() => {
    if (!open) return

    const onKey = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)

    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // 電腦版開啟時自動聚焦輸入框（手機不聚焦，避免鍵盤一下子蓋住畫面）
  useEffect(() => {
    if (open && window.matchMedia('(min-width: 640px)').matches) {
      inputRef.current?.focus()
    }
  }, [open])

  if (hidden) return null

  const goTo = path => {
    navigate(path)

    // 手機上視窗佔滿下半部，跳轉後收起來才看得到頁面
    if (window.matchMedia('(max-width: 639px)').matches) {
      setOpen(false)
    }
  }

  const send = async text => {
    const content = text.trim()

    if (!content || loading) return

    const next = [...messages, { role: 'user', content }]

    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      // 錯誤訊息只是顯示用，不送給 AI
      const history = next
        .filter(m => !m.error)
        .map(({ role, content: c }) => ({ role, content: c }))

      const { data } = await api.post('/assistant/chat', {
        messages: history,
        page: pathname
      })

      if (!data.success) {
        throw new Error(data.error || '小助理暫時無法回答')
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.data.reply }
      ])
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        '小助理暫時無法回答，請稍後再試'

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: message, error: true }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = e => {
    e.preventDefault()
    send(input)
  }

  return (
    <>
      {/* 收起時：右下角的圓形按鈕 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="開啟 PawCare 小助理"
          className="fixed z-30 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 text-white shadow-lg shadow-green-500/30 flex items-center justify-center transition-all"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.2A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />
            <circle cx="8.5" cy="11.5" r="0.6" fill="currentColor" />
            <circle cx="12" cy="11.5" r="0.6" fill="currentColor" />
            <circle cx="15.5" cy="11.5" r="0.6" fill="currentColor" />
          </svg>
        </button>
      )}

      {/* 展開時：手機為底部抽屜，電腦為右下角視窗 */}
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
            className="fixed z-40 inset-x-0 bottom-0 h-[80dvh] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[380px] sm:h-[min(560px,calc(100dvh-2rem))] bg-white border border-gray-200 shadow-2xl rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
          >
            {/* 標題列 */}
            <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-white">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shadow-sm">
                <span className="text-white text-base">🐾</span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">PawCare 小助理</p>
                <p className="text-[11px] text-gray-400">問我怎麼使用，或寵物照護小問題</p>
              </div>

              {messages.length > 0 && (
                <button
                  onClick={() => {
                    if (!loading) setMessages([])
                  }}
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
                    可以問我怎麼使用各項功能，或是日常寵物照護的小問題。
                  </p>
                </div>
              </div>

              {/* 建議問題 */}
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map(text => (
                    <button
                      key={text}
                      onClick={() => send(text)}
                      className="text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-full px-3 py-1.5 transition-colors"
                    >
                      {text}
                    </button>
                  ))}
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
                  <div key={i} className="flex">
                    <div
                      className={`max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed border ${
                        m.error
                          ? 'bg-red-50 border-red-100 text-red-600'
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      <MessageText text={m.content} onLink={goTo} />
                    </div>
                  </div>
                )
              )}

              {/* 回覆中 */}
              {loading && (
                <div className="flex">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* 輸入列 */}
            <form
              onSubmit={handleSubmit}
              className="shrink-0 border-t border-gray-100 bg-white px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  maxLength={MAX_INPUT}
                  placeholder="輸入想問的問題…"
                  className="flex-1 min-w-0 border border-gray-200 rounded-full px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all"
                />

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="送出"
                  className="shrink-0 w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:hover:bg-green-500 text-white flex items-center justify-center transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                  </svg>
                </button>
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