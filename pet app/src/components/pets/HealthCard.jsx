import EmptyState from '../ui/EmptyState'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { todayString } from '../../lib/petInsights'
import {
  MANUAL_TYPES, TYPE_LABEL, day,
  addMonths, upcomingReminders, useHealthRecords
} from '../../lib/petHealth'

const inputCls =
  'w-full border border-sand rounded-xl px-3 py-2 text-sm bg-cream text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-pine-700/35 focus:border-pine-700/40 focus:bg-plate transition-all'

const SEVERITY = {
  emergency: { label: '緊急', cls: 'bg-clay-100 text-clay' },
  urgent: { label: '建議就醫', cls: 'bg-honey-100 text-honey-ink' }
}

/* 紀錄類型圖示：線條風格（取代原本的 emoji） */
const TYPE_ICON = {
  vaccine: (
    <>
      <path d="M14 4l6 6" />
      <path d="M17.5 6.5 9 15l-1.5 4.5L12 18l8.5-8.5" />
      <path d="M4.5 19.5 7 17" />
      <path d="M13 8.5 15.5 11" />
    </>
  ),
  deworm: (
    <>
      <rect x="4.5" y="9.5" width="15" height="5" rx="2.5" transform="rotate(-40 12 12)" />
      <path d="M9.6 8.9l5.5 5.5" />
    </>
  ),
  checkup: (
    <>
      <path d="M6 4v6a5 5 0 0 0 10 0V4" />
      <path d="M6 4H4M18 4h-2" />
      <path d="M11 15v2a4 4 0 0 0 8 0v-1" />
      <circle cx="19" cy="13" r="1.6" />
    </>
  ),
  visit: (
    <>
      <path d="M4.5 20V8.5L12 4l7.5 4.5V20" />
      <path d="M12 10v5M9.5 12.5h5" />
      <path d="M9 20v-3.5h6V20" />
    </>
  ),
  surgery: (
    <>
      <path d="M6 4l7.5 9.5" />
      <path d="M18 4l-7.5 9.5" />
      <circle cx="7.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="18" r="2.5" />
    </>
  ),
  other: (
    <>
      <path d="M6.5 4.5h7L18 9v10.5H6.5Z" />
      <path d="M13 4.5V9h4.5" />
      <path d="M9.5 13h5M9.5 16h3" />
    </>
  ),
  default: (
    <>
      <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z" />
      <path d="M10 21h4" />
    </>
  )
}

function TypeIcon({ type, size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {TYPE_ICON[type] || TYPE_ICON.default}
    </svg>
  )
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
    <section className="rounded-3xl border border-hair shadow-card bg-plate p-5" aria-label="健康紀錄與提醒">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-pine-900">健康紀錄與提醒</h2>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-xl border border-hair-strong bg-cream px-3 py-1.5 text-xs font-bold text-pine-800 transition-colors hover:bg-warm"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d={open ? 'M5 12h14' : 'M12 5v14M5 12h14'} />
          </svg>
          {open ? '收起' : '新增紀錄'}
        </button>
      </div>

      {/* 即將到來的提醒 */}
      {reminders.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="即將到來的提醒">
          {reminders.slice(0, 3).map(r => (
            <li
              key={r.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${r.daysLeft <= 7
                  ? 'border-honey-200 bg-honey-50 text-honey-ink'
                  : 'border-sand bg-cream text-ink-soft'
                }`}
            >
              <TypeIcon type={r.type} size={14} />
              <span className="min-w-0 flex-1 truncate font-semibold">{r.title}</span>
              <span className="shrink-0 tabular-nums opacity-90">
                {r.daysLeft === 0 ? '今天' : `${r.daysLeft} 天後`}（{r.date}）
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 新增紀錄 */}
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3 rounded-2xl bg-cream p-3">
          <div role="group" aria-label="紀錄類型" className="flex flex-wrap gap-1.5">
            {MANUAL_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                aria-pressed={form.type === t.value}
                onClick={() => patchForm({ type: t.value }, 'type')}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${form.type === t.value
                    ? 'border-pine-700 bg-pine-800 text-warm'
                    : 'border-sand bg-plate text-ink-soft hover:border-pine-700/40 hover:text-pine-800'
                  }`}
              >
                <TypeIcon type={t.value} size={13} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label htmlFor="hc-title" className="mb-1 block text-xs font-semibold text-ink-soft">名稱</label>
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
              <label htmlFor="hc-date" className="mb-1 block text-xs font-semibold text-ink-soft">日期</label>
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
              <label htmlFor="hc-next" className="mb-1 block text-xs font-semibold text-ink-soft">下次提醒日期（選填）</label>
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
              <label htmlFor="hc-clinic" className="mb-1 block text-xs font-semibold text-ink-soft">診所（選填）</label>
              <input
                id="hc-clinic"
                value={form.clinic}
                maxLength={100}
                onChange={e => patchForm({ clinic: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="hc-cost" className="mb-1 block text-xs font-semibold text-ink-soft">費用（選填）</label>
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
              <label htmlFor="hc-desc" className="mb-1 block text-xs font-semibold text-ink-soft">備註（選填）</label>
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
            <p role="alert" className="text-xs text-clay">
              {addRecord.error?.response?.data?.error || '儲存失敗，請稍後再試'}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-line bg-plate py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-warm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={addRecord.isPending}
              className="flex-1 rounded-xl bg-honey py-2 text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none disabled:opacity-50"
            >
              {addRecord.isPending ? '儲存中…' : '儲存紀錄'}
            </button>
          </div>
        </form>
      )}

      {/* 時間軸 */}
      {isLoading ? (
        <div className="skeleton mt-4 h-24" />
      ) : sorted.length === 0 ? (
        <EmptyState
          compact
          className="mt-4"
          icon="heart"
          title="還沒有健康紀錄"
          desc="疫苗、驅蟲、看診都可以記在這裡，並設定下次提醒日期。"
        />
      ) : (
        <>
          <ol className="mt-4 space-y-3 border-l-2 border-hair pl-4">
            {visible.map(r => {
              const sev = SEVERITY[r.severity]
              return (
                <li key={r.id} className="relative">
                  <span className="absolute -left-[1.42rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-plate bg-pine-700" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-pine-50 px-2 py-0.5 text-[11px] font-semibold text-pine-700">
                      <TypeIcon type={r.type} size={12} />
                      {TYPE_LABEL[r.type] || r.type}
                    </span>
                    {r.source === 'ai_consult' && (
                      <span className="rounded-full bg-plum-50 px-2 py-0.5 text-[11px] font-semibold text-plum-700">AI 諮詢</span>
                    )}
                    {sev && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sev.cls}`}>{sev.label}</span>
                    )}
                    <span className="text-xs tabular-nums text-ink-soft/80">{day(r.date)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`刪除「${r.title}」這筆紀錄？`)) removeRecord.mutate(r.id)
                      }}
                      disabled={removeRecord.isPending}
                      aria-label={`刪除 ${r.title}`}
                      className="ml-auto rounded-lg px-2 py-0.5 text-xs text-ink-soft/80 transition-colors hover:bg-clay-50 hover:text-clay disabled:opacity-50"
                    >
                      刪除
                    </button>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-pine-900">{r.title}</p>
                  {r.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{r.description}</p>}
                  <p className="mt-0.5 text-[11px] text-ink-soft/80">
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
              className="mt-3 text-xs font-semibold text-pine-700 hover:underline"
            >
              {showAll ? '收合' : `顯示全部 ${sorted.length} 筆`}
            </button>
          )}
          {removeRecord.isError && (
            <p role="alert" className="mt-2 text-xs text-clay">刪除失敗，請稍後再試</p>
          )}
        </>
      )}
    </section>
  )
}