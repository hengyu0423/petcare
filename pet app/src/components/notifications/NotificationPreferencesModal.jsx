import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

// ======================================================
// 通知偏好設定
// ======================================================

const TYPE_INFO = [
  { key: 'camera_missing', icon: '📷', label: '寵物離開鏡頭', desc: '攝影機超過一段時間偵測不到寵物' },
  { key: 'camera_reappeared', icon: '🐱', label: '寵物回到鏡頭前', desc: '離開後又重新出現在畫面中' },
  { key: 'health_alert', icon: '🩺', label: '健康提醒', desc: '健康諮詢 AI 記錄到需要留意的健康事件' },
  { key: 'weekly_report_ready', icon: '📋', label: '週報完成', desc: '每週的健康與飲食週報產生完成' },
  { key: 'feeding_reminder', icon: '🍽️', label: '飲食提醒', desc: '偵測到飲食異常，例如食物過於集中或零食偏多' }
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

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">

        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="text-base font-bold text-gray-800">通知設定</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-6">

          {isLoading && (
            <p className="text-sm text-gray-400 py-6 text-center">讀取中…</p>
          )}

          {prefs && (
            <div className="space-y-1">
              {TYPE_INFO.map(t => (
                <label
                  key={t.key}
                  className="flex items-start gap-3 py-2.5 cursor-pointer"
                >
                  <span className="text-lg shrink-0">{t.icon}</span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {t.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggle(t.key)}
                    className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${
                      prefs[t.key] ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        prefs[t.key] ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          )}

          {save.isError && (
            <p className="text-xs text-red-500 mt-3">儲存失敗，請稍後再試。</p>
          )}

        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            取消
          </button>

          <button
            type="button"
            disabled={!prefs || save.isPending}
            onClick={() => save.mutate(prefs)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
          >
            {save.isPending ? '儲存中…' : '儲存'}
          </button>
        </div>

      </div>
    </div>
  )
}