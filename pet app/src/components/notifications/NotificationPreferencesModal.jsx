import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  VideoOff,
  Video,
  AlertTriangle,
  ClipboardCheck,
  Utensils,
  X
} from 'lucide-react'
import { BracketTitle, Button } from '@endfield-ui/react'
import { api } from '../../lib/api'

// ======================================================
// 通知偏好設定彈窗 (Endfield UI 工業寬敞風格)
// ======================================================

const TYPE_INFO = [
  { key: 'camera_missing', icon: VideoOff, label: '寵物離開鏡頭', desc: '攝影機超過一段時間未偵測到寵物活動時提醒' },
  { key: 'camera_reappeared', icon: Video, label: '寵物回到畫面', desc: '離開鏡頭後重新捕捉到寵物身影時通知' },
  { key: 'health_alert', icon: AlertTriangle, label: '健康異常提醒', desc: '健康諮詢 AI 記錄到需關注之毛孩健康異常' },
  { key: 'weekly_report_ready', icon: ClipboardCheck, label: '週報完成通知', desc: '每週健康與飲食綜合分析週報產出時通知' },
  { key: 'feeding_reminder', icon: Utensils, label: '飲食狀況提醒', desc: '偵測到進食異常，例如熱量過度集中或零食偏多' }
]

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

  const modalContent = (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-[100] p-4 sm:p-6 font-sans animate-fade-in">
      <div className="bg-white border-2 border-[#191919] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

        {/* 頂部標題列 */}
        <div className="flex items-start justify-between px-6 py-4 bg-[#f8f9fa] border-b border-[#e5e5e5]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#fffa00] border border-[#191919]" />
              <BracketTitle level={3} className="text-sm font-bold text-[#191919]">
                通知偏好設定 // PREFERENCES
              </BracketTitle>
            </div>
            <p className="text-xs text-[#8a8a8a] font-mono mt-1">
              // 自訂接收各項寵物生活與健康即時通知
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#626262] hover:text-[#191919] hover:bg-[#e5e5e5] transition-colors"
            aria-label="關閉"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* 內容設定列 */}
        <div className="p-6 overflow-y-auto max-h-[65vh] space-y-2">
          {isLoading ? (
            <div className="py-12 text-center font-mono space-y-2">
              <div className="inline-block w-5 h-5 border-2 border-[#191919] border-t-transparent animate-spin rounded-full" />
              <p className="text-xs text-[#8a8a8a]">讀取通知偏好設定中...</p>
            </div>
          ) : prefs ? (
            <div className="divide-y divide-[#f0f0f0]">
              {TYPE_INFO.map(t => {
                const Icon = t.icon
                const enabled = !!prefs[t.key]
                return (
                  <div
                    key={t.key}
                    onClick={() => toggle(t.key)}
                    className="flex items-center justify-between gap-4 py-3.5 px-2 hover:bg-[#fafafa] transition-colors cursor-pointer group select-none"
                  >
                    {/* 左側圖示 + 文字說明 */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-9 h-9 border border-[#d9d9d9] bg-white flex items-center justify-center text-[#191919] shrink-0 group-hover:border-[#191919] transition-colors shadow-2xs">
                        <Icon size={17} strokeWidth={2} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#191919] group-hover:text-black transition-colors">
                          {t.label}
                        </p>
                        <p className="text-xs text-[#626262] mt-0.5 leading-normal">
                          {t.desc}
                        </p>
                      </div>
                    </div>

                    {/* 工業風平滑切換開關 */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={e => {
                        e.stopPropagation()
                        toggle(t.key)
                      }}
                      className={`relative w-12 h-6.5 rounded-full transition-colors shrink-0 ${
                        enabled
                          ? 'bg-[#191919]'
                          : 'bg-[#e5e5e5]'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full transition-transform ${
                          enabled
                            ? 'translate-x-6 bg-[#fffa00]'
                            : 'translate-x-1 bg-white shadow-xs'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : null}

          {save.isError && (
            <p className="text-xs font-mono text-[#de0909] pt-2">
              ※ 偏好儲存失敗，請檢查網路連線後重試。
            </p>
          )}
        </div>

        {/* 底部操作按鈕區 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#f8f9fa] border-t border-[#e5e5e5]">
          <Button
            variant="light"
            size="sm"
            onClick={onClose}
          >
            取消
          </Button>

          <Button
            variant="action"
            size="sm"
            disabled={!prefs || save.isPending}
            onClick={() => save.mutate(prefs)}
          >
            {save.isPending ? '儲存中...' : '確認儲存'}
          </Button>
        </div>

      </div>
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent
}