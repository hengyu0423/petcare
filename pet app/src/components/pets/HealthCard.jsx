import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Syringe,
  ShieldCheck,
  Stethoscope,
  Building2,
  Activity,
  FileText,
  Plus,
  Trash2,
  Bell,
  Clock,
  Calendar,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Tag, CornerBrackets } from '@endfield-ui/react'
import { api } from '../../lib/api'
import { todayString } from '../../lib/petInsights'
import {
  MANUAL_TYPES, TYPE_LABEL, day,
  addMonths, upcomingReminders, useHealthRecords
} from '../../lib/petHealth'

const inputCls =
  'w-full border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#191919] focus:outline-hidden focus:border-[#191919] focus:bg-white transition-colors placeholder:text-[#8a8a8a]'

const TYPE_CONFIG = {
  vaccine: {
    icon: Syringe,
    label: '疫苗注射',
    badge: 'border-sky-300 bg-sky-50 text-sky-800 font-bold',
    dot: 'bg-sky-500 ring-4 ring-sky-100',
    iconBg: 'bg-sky-100 text-sky-700 border-sky-300',
    selected: 'border-sky-500 bg-sky-600 text-white shadow-xs'
  },
  deworm: {
    icon: ShieldCheck,
    label: '預防驅蟲',
    badge: 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold',
    dot: 'bg-emerald-500 ring-4 ring-emerald-100',
    iconBg: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    selected: 'border-emerald-500 bg-emerald-600 text-white shadow-xs'
  },
  checkup: {
    icon: Stethoscope,
    label: '健康檢查',
    badge: 'border-purple-300 bg-purple-50 text-purple-800 font-bold',
    dot: 'bg-purple-500 ring-4 ring-purple-100',
    iconBg: 'bg-purple-100 text-purple-700 border-purple-300',
    selected: 'border-purple-500 bg-purple-600 text-white shadow-xs'
  },
  visit: {
    icon: Building2,
    label: '常規看診',
    badge: 'border-amber-300 bg-amber-50 text-amber-900 font-bold',
    dot: 'bg-amber-500 ring-4 ring-amber-100',
    iconBg: 'bg-amber-100 text-amber-700 border-amber-300',
    selected: 'border-amber-500 bg-amber-600 text-white shadow-xs'
  },
  surgery: {
    icon: Activity,
    label: '手術處置',
    badge: 'border-rose-300 bg-rose-50 text-rose-900 font-bold',
    dot: 'bg-rose-500 ring-4 ring-rose-100',
    iconBg: 'bg-rose-100 text-rose-700 border-rose-300',
    selected: 'border-rose-500 bg-rose-600 text-white shadow-xs'
  },
  other: {
    icon: FileText,
    label: '其他項目',
    badge: 'border-[#191919] bg-[#fffa00] text-[#191919] font-bold',
    dot: 'bg-[#191919] ring-4 ring-yellow-200',
    iconBg: 'bg-yellow-100 text-[#191919] border-yellow-300',
    selected: 'border-[#191919] bg-[#191919] text-[#fffa00] shadow-xs'
  }
}

const TYPE_ICONS = Object.fromEntries(
  Object.entries(TYPE_CONFIG).map(([k, v]) => [k, v.icon])
)

const SEVERITY = {
  emergency: { label: '🚨 緊急狀況', cls: 'bg-red-500 text-white border-red-500 shadow-xs' },
  urgent: { label: '⚠️ 建議就醫', cls: 'bg-amber-100 text-amber-900 border-amber-300 font-bold' }
}

const PREVIEW = 6

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
  const [touched, setTouched] = useState({ title: false, nextDate: false })

  const typeInfo = MANUAL_TYPES.find(t => t.value === form.type)

  const patchForm = (patch, touchedKey) => {
    setForm(f => {
      const next = { ...f, ...patch }
      const t = MANUAL_TYPES.find(x => x.value === next.type)
      if (!touchedKey || touchedKey === 'type' || touchedKey === 'date') {
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
    <section
      data-theme="light"
      className="relative bg-white border border-[#e5e5e5] p-5 shadow-xs"
      aria-label="健康紀錄與提醒"
    >
      <CornerBrackets size="sm" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] pb-3">
        <div>
          <div className="text-[10px] font-mono font-bold tracking-wider text-[#8a8a8a]">
            // MEDICAL_RECORDS & ALERTS
          </div>
          <h2 className="text-base font-bold text-[#191919]">健康紀錄與排程提醒</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className={`h-8 px-3 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border ${
            open
              ? 'border-[#191919] bg-[#191919] text-[#fffa00]'
              : 'border-[#191919] bg-white text-[#191919] hover:bg-[#fffa00]'
          }`}
        >
          {open ? (
            <>
              <ChevronUp size={14} /> 收起表單
            </>
          ) : (
            <>
              <Plus size={14} /> 新增健康紀錄
            </>
          )}
        </button>
      </div>

      {/* 即將到來的提醒 */}
      {reminders.length > 0 && (
        <div className="mt-4" aria-label="即將到來的提醒">
          <div className="text-[11px] font-mono text-[#8a8a8a] mb-2 flex items-center gap-1.5">
            <Bell size={13} className="text-[#191919]" />
            <span>近期即將到期項目 ({reminders.length})</span>
          </div>
          <div className="space-y-2">
            {reminders.slice(0, 3).map(r => {
              const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.other
              const Icon = cfg.icon
              const isUrgent = r.daysLeft <= 7
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-3.5 py-2.5 text-xs border border-l-4 transition-all shadow-2xs ${
                    isUrgent
                      ? 'border-red-300 border-l-red-500 bg-red-50/70 text-red-950'
                      : 'border-[#e5e5e5] border-l-[#191919] bg-white text-[#191919]'
                  }`}
                >
                  <div
                    className={`w-7 h-7 flex items-center justify-center shrink-0 border ${
                      isUrgent
                        ? 'border-red-400 bg-red-100 text-red-800'
                        : cfg.iconBg
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{r.title}</p>
                    <p className="text-[11px] font-mono text-[#8a8a8a]">預定日期：{r.date}</p>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 border ${
                      isUrgent
                        ? 'bg-red-500 text-white border-red-600 animate-pulse'
                        : 'bg-white text-[#191919] border-[#d9d9d9]'
                    }`}
                  >
                    {r.daysLeft === 0 ? 'TODAY' : `D-${r.daysLeft}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 新增紀錄表單 */}
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-4 border border-[#191919] bg-[#fafafa] p-4">
          <div className="text-[11px] font-mono font-bold tracking-wider text-[#191919] flex items-center gap-2">
            <span className="w-1.5 h-3 bg-[#fffa00] border border-[#191919]" />
            NEW_RECORD_ENTRY
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#555]">紀錄類別</label>
            <div role="group" aria-label="紀錄類型" className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {MANUAL_TYPES.map(t => {
                const cfg = TYPE_CONFIG[t.value] || TYPE_CONFIG.other
                const Icon = cfg.icon
                const isSelected = form.type === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => patchForm({ type: t.value }, 'type')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-mono font-bold border transition-colors ${
                      isSelected
                        ? cfg.selected
                        : 'border-[#e5e5e5] bg-white text-[#555] hover:border-[#191919] hover:text-[#191919]'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="hc-title" className="mb-1 block text-xs font-semibold text-[#555]">
                項目名稱 *
              </label>
              <input
                id="hc-title"
                required
                value={form.title}
                maxLength={100}
                onChange={e => patchForm({ title: e.target.value }, 'title')}
                placeholder="例如：年度狂犬病疫苗、四合一體內外驅蟲"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="hc-date" className="mb-1 block text-xs font-semibold text-[#555]">
                執行日期 *
              </label>
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
              <label htmlFor="hc-next" className="mb-1 block text-xs font-semibold text-[#555]">
                下次排程提醒（選填）
              </label>
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
              <label htmlFor="hc-clinic" className="mb-1 block text-xs font-semibold text-[#555]">
                醫療院所 / 機構（選填）
              </label>
              <input
                id="hc-clinic"
                value={form.clinic}
                maxLength={100}
                onChange={e => patchForm({ clinic: e.target.value })}
                placeholder="例如：台大動物醫院"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="hc-cost" className="mb-1 block text-xs font-semibold text-[#555]">
                醫療花費 (TWD)（選填）
              </label>
              <input
                id="hc-cost"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.cost}
                onChange={e => patchForm({ cost: e.target.value })}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="hc-desc" className="mb-1 block text-xs font-semibold text-[#555]">
                詳細醫囑與備註（選填）
              </label>
              <textarea
                id="hc-desc"
                rows={2}
                value={form.description}
                onChange={e => patchForm({ description: e.target.value })}
                placeholder="輸入醫生建議、副作用注意事項或檢查數值備忘..."
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {addRecord.isError && (
            <p role="alert" className="text-xs text-red-500 font-mono">
              [ERROR] {addRecord.error?.response?.data?.error || '儲存失敗，請檢查輸入'}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-2 text-xs font-mono font-medium border border-[#d9d9d9] bg-white text-[#555] hover:border-[#191919] hover:text-[#191919] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={addRecord.isPending}
              className="flex-1 py-2 text-xs font-mono font-bold border border-[#191919] bg-[#fffa00] text-[#191919] hover:bg-black hover:text-[#fffa00] transition-colors disabled:opacity-50"
            >
              {addRecord.isPending ? '儲存中...' : '確認登記紀錄'}
            </button>
          </div>
        </form>
      )}

      {/* 時間軸紀錄列表 */}
      {isLoading ? (
        <div className="mt-4 h-28 animate-pulse bg-[#fafafa] border border-[#e5e5e5]" />
      ) : sorted.length === 0 ? (
        <div className="mt-4 border border-dashed border-[#d9d9d9] bg-[#fafafa] px-4 py-8 text-center text-xs text-[#8a8a8a]">
          <Activity size={24} className="mx-auto mb-2 text-[#8a8a8a] stroke-[1.5]" />
          目前尚無健康紀錄。疫苗注射、驅蟲保養、常規看診與健檢皆可在此登記。
        </div>
      ) : (
        <div className="mt-5">
          <div className="text-[10px] font-mono font-bold tracking-wider text-[#8a8a8a] mb-3">
            // TIMELINE_ENTRIES ({sorted.length})
          </div>
          <ol className="relative space-y-4 border-l-2 border-[#e5e5e5] pl-4 ml-2">
            {visible.map(r => {
              const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.other
              const Icon = cfg.icon
              const sev = SEVERITY[r.severity]
              return (
                <li key={r.id} className="relative group pl-1">
                  {/* Colored Timeline point with glow ring */}
                  <span
                    className={`absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full border border-white shadow-xs ${cfg.dot}`}
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-mono font-bold ${cfg.badge}`}>
                      <Icon size={11} />
                      {TYPE_LABEL[r.type] || r.type}
                    </span>
                    {r.source === 'ai_consult' && (
                      <span className="inline-flex items-center gap-1 border border-violet-300 bg-gradient-to-r from-violet-50 to-purple-50 px-2 py-0.5 text-[11px] font-mono font-bold text-violet-800 shadow-2xs">
                        <Sparkles size={11} /> AI 諮詢彙整
                      </span>
                    )}
                    {sev && (
                      <span className={`border px-2 py-0.5 text-[11px] font-mono font-bold ${sev.cls}`}>
                        {sev.label}
                      </span>
                    )}
                    <span className="font-mono text-xs text-[#8a8a8a] ml-1">{day(r.date)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`確定刪除「${r.title}」紀錄？`)) removeRecord.mutate(r.id)
                      }}
                      disabled={removeRecord.isPending}
                      aria-label={`刪除 ${r.title}`}
                      className="ml-auto text-xs font-mono text-[#8a8a8a] hover:text-red-600 transition-colors opacity-80 group-hover:opacity-100 flex items-center gap-1 disabled:opacity-30"
                    >
                      <Trash2 size={12} />
                      <span>刪除</span>
                    </button>
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#191919]">{r.title}</p>
                  {r.description && (
                    <p className="mt-1 text-xs text-[#555] bg-[#fafafa] border-l-2 border-[#191919] pl-2 py-1 leading-relaxed">
                      {r.description}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-[#8a8a8a]">
                    {[
                      r.clinic,
                      r.cost ? `NT$ ${Number(r.cost).toLocaleString()}` : null,
                      day(r.next_date) ? `下次排程：${day(r.next_date)}` : null
                    ]
                      .filter(Boolean)
                      .join(' // ')}
                  </p>
                </li>
              )
            })}
          </ol>
          {sorted.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="mt-3 text-xs font-mono font-semibold text-[#191919] hover:underline flex items-center gap-1"
            >
              {showAll ? '▲ 收合紀錄' : `▼ 展開全部 ${sorted.length} 筆歷史健康紀錄`}
            </button>
          )}
          {removeRecord.isError && (
            <p role="alert" className="mt-2 text-xs font-mono text-red-500">
              [ERROR] 刪除失敗，請稍後再試
            </p>
          )}
        </div>
      )}
    </section>
  )
}