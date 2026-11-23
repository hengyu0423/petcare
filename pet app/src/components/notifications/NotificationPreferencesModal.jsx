import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

// ======================================================
// 通知偏好設定
// ======================================================

const TYPE_INFO = [
  { key: 'camera_missing', label: '寵物離開鏡頭', desc: '攝影機超過一段時間偵測不到寵物' },
  { key: 'camera_reappeared', label: '寵物回到鏡頭前', desc: '離開後又重新出現在畫面中' },
  { key: 'health_alert', label: '健康提醒', desc: '健康諮詢 AI 記錄到需要留意的健康事件' },
  { key: 'weekly_report_ready', label: '週報完成', desc: '每週的健康與飲食週報產生完成' },
  { key: 'feeding_reminder', label: '飲食提醒', desc: '偵測到飲食異常，例如食物過於集中或零食偏多' }
]

const ICON = {
  camera_missing: <><path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
  camera_reappeared: <><path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4Z" /><circle cx="12" cy="13" r="3.5" /><path d="M9 13l2 2 4-4" /></>,
  health_alert: <><path d="M6 4v5a4 4 0 0 0 8 0V4" /><path d="M10 13v2.5a4.5 4.5 0 0 0 9 0V13" /><circle cx="19" cy="12" r="1.8" /></>,
  weekly_report_ready: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
  feeding_reminder: <><path d="M3.5 11.5h17" /><path d="M5 11.5c0 4.7 3.1 8 7 8s7-3.3 7-8" /><path d="M9 8c0-1.7 1.4-3 3-3s3 1.3 3 3" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5l1 2 2.2-.5 1.1 2-1.4 1.8 1.4 1.8-1.1 2-2.2-.5-1 2h-2l-1-2-2.2.5-1.1-2 1.4-1.8-1.4-1.8 1.1-2 2.2.5 1-2h2Z" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />
}

function LineIcon({ name, size = 16, className = '' }) {
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
      className={`shrink-0 ${className}`}
    >
      {ICON[name] || ICON.gear}
    </svg>
  )
}

export default function NotificationPreferencesModal({ onClose }) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.get('/notifications/preferences').then(r => r.data.preferences)
  })

  const [draft, setDraft] = useState(null)
  const prefs = draft || data

  const save = useMutation({
    mutationFn: next =>
      api.put('/notifications/preferences', next).then(r => r.data.preferences),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-preferences'] })
      onClose()
    }
  })

  const toggle = key => {
    const next = { ...prefs, [key]: !prefs[key] }
    setDraft(next)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-pine-900/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-hair bg-plate shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pine-800 text-honey">
              <LineIcon name="gear" size={17} />
            </span>
            <h2 className="font-brand text-base font-extrabold text-pine-900">通知設定</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-warm hover:text-pine-900"
          >
            <LineIcon name="close" size={15} />
          </button>
        </div>

        <div className="p-4">
          {isLoading && (
            <p className="py-6 text-center text-sm text-ink-soft">讀取中…</p>
          )}

          {prefs && (
            <div className="space-y-1.5">
              {TYPE_INFO.map(t => (
                <div
                  key={t.key}
                  onClick={() => toggle(t.key)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-transparent p-3 transition-colors hover:border-sand hover:bg-cream"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warm text-pine-700">
                      <LineIcon name={t.key} size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-pine-900">{t.label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{t.desc}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!prefs[t.key]}
                    aria-label={t.label}
                    onClick={e => {
                      e.stopPropagation()
                      toggle(t.key)
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none ${
                      prefs[t.key] ? 'bg-pine-700' : 'bg-[#ddd8c8]'
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-plate shadow-sm transition-transform ${
                        prefs[t.key] ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {save.isError && (
            <p className="mt-3 text-xs font-semibold text-clay">儲存失敗，請稍後再試。</p>
          )}
        </div>

        <div className="flex gap-3 border-t border-hair px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-cream py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-[#f0ece0]"
          >
            取消
          </button>

          <button
            type="button"
            disabled={!prefs || save.isPending}
            onClick={() => save.mutate(prefs)}
            className="flex-1 rounded-xl bg-honey py-2.5 text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none disabled:opacity-50"
          >
            {save.isPending ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
