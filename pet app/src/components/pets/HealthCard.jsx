import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { todayString } from '../../lib/petInsights'
import {
  MANUAL_TYPES, TYPE_LABEL, TYPE_EMOJI, day,
  addMonths, upcomingReminders, useHealthRecords
} from '../../lib/petHealth'

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all'

const SEVERITY = {
  emergency: { label: '緊急', cls: 'bg-red-100 text-red-700' },
  urgent: { label: '建議就醫', cls: 'bg-amber-100 text-amber-800' }
}

const PREVIEW = 6

// 預設選第一個類型（疫苗），名稱與下次提醒日期一開始就帶好，使用者可以直接改
const emptyForm = today => {
  const first = MANUAL_TYPES[0]
  return {
    type: first.value,
    title: first.label,
    date: today,
    nextDate: first.nextMonths ? addMonths(today, first.nextMonths) : '',
    clinic: '',
    cost: '',
    description: ''
  }
}

export default function HealthCard({ petId }) {
  const qc = useQueryClient()
  const today = todayString()

  const { data: records = [], isLoading } = useHealthRecords(petId)

  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [form, setForm] = useState(() => emptyForm(today))
  // 使用者自己動過的欄位，就不再自動帶入
  const [touched, setTouched] = useState({ title: false, nextDate: false })

  const typeInfo = MANUAL_TYPES.find(t => t.value === form.type)

  const patchForm = (patch, touchedKey) => {
    setForm(f => {
      const next = { ...f, ...patch }
      const t = MANUAL_TYPES.find(x => x.value === next.type)
      if (!touchedKey || touchedKey === 'type' || touchedKey === 'date') {
        // 還沒手動改過的欄位，跟著類型／日期自動帶入
        if (!touched.title) next.title = t?.label || ''
        if (!touched.nextDate) next.nextDate = t?.nextMonths ? addMonths(next.date, t.nextMonths) : ''
      }
      return next
    })
    if (touchedKey === 'title' || touchedKey === 'nextDate') {
      setTouched(t => ({ ...t, [touchedKey]: true }))
    }
  }

  const reminders = upcomingReminders(records, today)

  const addRecord = useMutation({
    mutationFn: payload => api.post('/health-records', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pet-health', petId] })
      setForm(emptyForm(today))
      setTouched({ title: false, nextDate: false })
      setOpen(false)
    }
  })

  const removeRecord = useMutation({
    mutationFn: id => api.delete(`/health-records/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pet-health', petId] })
  })

  const submit = e => {
    e.preventDefault()
    addRecord.mutate({
      petId,
      type: form.type,
      title: form.title.trim() || typeInfo.label,
      date: form.date,
      nextDate: form.nextDate || undefined,
      clinic: form.clinic.trim() || undefined,
      cost: form.cost ? Number(form.cost) : undefined,
      description: form.description.trim() || undefined
    })
  }

  const sorted = [...records].sort(
    (a, b) => day(b.date).localeCompare(day(a.date)) || b.id - a.id
  )
  const visible = showAll ? sorted : sorted.slice(0, PREVIEW)

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5" aria-label="健康紀錄與提醒">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-800">健康紀錄與提醒</h2>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-green-600 transition-colors hover:bg-green-50"
        >
          {open ? '收起' : '＋ 新增紀錄'}
        </button>
      </div>

      {/* 即將到來的提醒 */}
      {reminders.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="即將到來的提醒">
          {reminders.slice(0, 3).map(r => (
            <li
              key={r.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${r.daysLeft <= 7 ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-600'
                }`}
            >
              <span aria-hidden="true">{TYPE_EMOJI[r.type] || '🔔'}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
              <span className="shrink-0">
                {r.daysLeft === 0 ? '今天' : `${r.daysLeft} 天後`}（{r.date}）
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 新增紀錄 */}
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl bg-gray-50 p-3">
          <div role="group" aria-label="紀錄類型" className="flex flex-wrap gap-1.5">
            {MANUAL_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                aria-pressed={form.type === t.value}
                onClick={() => patchForm({ type: t.value }, 'type')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${form.type === t.value
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                  }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label htmlFor="hc-title" className="mb-1 block text-xs font-semibold text-gray-500">名稱</label>
              <input
                id="hc-title"
                required
                value={form.title}
                maxLength={100}
                onChange={e => patchForm({ title: e.target.value }, 'title')}
                placeholder="例如：年度疫苗、體內驅蟲"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="hc-date" className="mb-1 block text-xs font-semibold text-gray-500">日期</label>
              <input
                id="hc-date"
                type="date"
                required
                max={today}
                value={form.date}
                onChange={e => patchForm({ date: e.target.value }, 'date')}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="hc-next" className="mb-1 block text-xs font-semibold text-gray-500">下次提醒日期（選填）</label>
              <input
                id="hc-next"
                type="date"
                min={form.date || undefined}
                value={form.nextDate}
                onChange={e => patchForm({ nextDate: e.target.value }, 'nextDate')}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="hc-clinic" className="mb-1 block text-xs font-semibold text-gray-500">診所（選填）</label>
              <input
                id="hc-clinic"
                value={form.clinic}
                maxLength={100}
                onChange={e => patchForm({ clinic: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="hc-cost" className="mb-1 block text-xs font-semibold text-gray-500">費用（選填）</label>
              <input
                id="hc-cost"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.cost}
                onChange={e => patchForm({ cost: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="hc-desc" className="mb-1 block text-xs font-semibold text-gray-500">備註（選填）</label>
              <textarea
                id="hc-desc"
                rows={2}
                value={form.description}
                onChange={e => patchForm({ description: e.target.value })}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {addRecord.isError && (
            <p role="alert" className="text-xs text-red-500">
              {addRecord.error?.response?.data?.error || '儲存失敗，請稍後再試'}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={addRecord.isPending}
              className="flex-1 rounded-lg bg-green-500 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-600 disabled:opacity-50"
            >
              {addRecord.isPending ? '儲存中…' : '儲存紀錄'}
            </button>
          </div>
        </form>
      )}

      {/* 時間軸 */}
      {isLoading ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-50" />
      ) : sorted.length === 0 ? (
        <div className="mt-4 rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
          <p className="mb-1 text-3xl">🩺</p>
          還沒有健康紀錄。疫苗、驅蟲、看診都可以記在這裡，並設定下次提醒日期。
        </div>
      ) : (
        <>
          <ol className="mt-4 space-y-3 border-l-2 border-gray-100 pl-4">
            {visible.map(r => {
              const sev = SEVERITY[r.severity]
              return (
                <li key={r.id} className="relative">
                  <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-400" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {TYPE_EMOJI[r.type] ? `${TYPE_EMOJI[r.type]} ` : ''}{TYPE_LABEL[r.type] || r.type}
                    </span>
                    {r.source === 'ai_consult' && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600">AI 諮詢</span>
                    )}
                    {sev && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sev.cls}`}>{sev.label}</span>
                    )}
                    <span className="text-xs text-gray-400">{day(r.date)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`刪除「${r.title}」這筆紀錄？`)) removeRecord.mutate(r.id)
                      }}
                      disabled={removeRecord.isPending}
                      aria-label={`刪除 ${r.title}`}
                      className="ml-auto rounded-md px-2 py-0.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      刪除
                    </button>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-gray-700">{r.title}</p>
                  {r.description && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{r.description}</p>}
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {[
                      r.clinic,
                      r.cost ? `TWD ${Number(r.cost).toLocaleString()}` : null,
                      day(r.next_date) ? `下次：${day(r.next_date)}` : null
                    ]
                      .filter(Boolean)
                      .join(' ・ ')}
                  </p>
                </li>
              )
            })}
          </ol>
          {sorted.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="mt-3 text-xs font-medium text-green-600 hover:underline"
            >
              {showAll ? '收合' : `顯示全部 ${sorted.length} 筆`}
            </button>
          )}
          {removeRecord.isError && (
            <p role="alert" className="mt-2 text-xs text-red-500">刪除失敗，請稍後再試</p>
          )}
        </>
      )}
    </section>
  )
}