import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const CATEGORIES = [
  { value: 'food', label: '飼料 / 零食' },
  { value: 'medical', label: '醫療 / 疫苗' },
  { value: 'grooming', label: '美容 / 洗澡' },
  { value: 'toy', label: '玩具 / 用品' },
  { value: 'boarding', label: '寄宿 / 托育' },
  { value: 'other', label: '其他' }
]

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

const fieldCls =
  'w-full border border-[#eae6d8] rounded-xl px-3 py-2.5 text-sm bg-[#faf7ef] text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-pine-700/35 focus:border-pine-700/40 focus:bg-plate transition-all'

const labelCls = 'mb-1.5 block text-[12px] font-semibold text-ink-soft'

/* 線條圖示：取代原本的 emoji */
const ICON = {
  food: <><path d="M4 12h16" /><path d="M5 12c0 4.5 3.1 7.5 7 7.5s7-3 7-7.5" /><path d="M8 8.5c0-1.5 1.8-2.5 4-2.5s4 1 4 2.5" /></>,
  medical: <><path d="M4.5 20V8.5L12 4l7.5 4.5V20" /><path d="M12 10v5M9.5 12.5h5" /><path d="M9 20v-3.5h6V20" /></>,
  grooming: <><path d="M6 4l12 12M18 4L6 16" /><circle cx="7" cy="18.5" r="2" /><circle cx="17" cy="18.5" r="2" /></>,
  toy: <><circle cx="12" cy="12" r="7.5" /><path d="M12 4.5 9 8.5h6L12 4.5ZM5 10l4 2-1.5 3.5M19 10l-4 2 1.5 3.5" /></>,
  boarding: <><path d="M4.5 10 12 4l7.5 6" /><path d="M6.5 9.5V20h11V9.5" /><path d="M10 20v-5h4v5" /></>,
  other: <><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5.5h6V7M4 12h16" /></>,
  wallet: <><path d="M4 7.5h13.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5a1.5 1.5 0 0 1-1.5-1.5V7.5Z" /><path d="M4 7.5V6a1.5 1.5 0 0 1 1.5-1.5H16" /><circle cx="15.5" cy="13.5" r="1" fill="currentColor" stroke="none" /></>,
  chart: <><path d="M4 20V5M4 20h16" /><path d="M7.5 16l3.5-4 3 2 4.5-6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <><path d="M4.5 7h15" /><path d="M9 7V5h6v2" /><path d="M6.5 7l.8 12h9.4l.8-12" /><path d="M10 10.5v5M14 10.5v5" /></>,
  back: <path d="M15 6l-6 6 6 6" />
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
      {ICON[name] || ICON.other}
    </svg>
  )
}

const twd = n => `TWD ${Number(n).toFixed(2)}`

function AddExpenseModal({ pets, onClose, onSave, saving }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    petId: pets[0]?.id || '',
    category: 'food',
    title: '',
    amount: '',
    date: today,
    notes: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-900/35 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#f0e6d2] bg-plate p-6 shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-brand text-xl font-extrabold text-pine-900">新增支出</h2>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-[#fdf6ea] hover:text-pine-900"
          >
            <LineIcon name="close" size={16} />
          </button>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault()
            onSave({ ...form, amount: Number(form.amount) })
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>選擇寵物</label>
            <select value={form.petId} onChange={e => set('petId', e.target.value)} className={fieldCls}>
              {pets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>類別</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => set('category', cat.value)}
                  className={`inline-flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition-colors ${
                    form.category === cat.value
                      ? 'border-pine-700 bg-pine-800 text-[#fdf8ec]'
                      : 'border-[#eae6d8] bg-[#faf7ef] text-ink-soft hover:border-pine-700/40'
                  }`}
                >
                  <LineIcon name={cat.value} size={17} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>支出名稱</label>
            <input required placeholder="例如：年度疫苗" value={form.title} onChange={e => set('title', e.target.value)} className={fieldCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>金額 (TWD)</label>
              <input type="number" step="0.01" min="0" required value={form.amount} onChange={e => set('amount', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>日期</label>
              <input type="date" required value={form.date} onChange={e => set('date', e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>備注（選填）</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className={`${fieldCls} resize-none`} />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-line bg-plate py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-[#fdf6ea]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#f5c04a] py-2.5 text-sm font-extrabold text-pine-900 shadow-[0_5px_0_#c96f2e] transition-all hover:bg-[#f0b23a] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
            >
              {saving ? '新增中…' : '新增支出'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ExpensesPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [filterPet, setFilterPet] = useState('all')

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  const { data: allExpenses = [], isLoading } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: async () => {
      if (pets.length === 0) return []
      const results = await Promise.all(
        pets.map(p => api.get(`/expenses/pet/${p.id}`).then(r =>
          r.data.data.map(e => ({ ...e, pet_name: p.name, species: p.species }))
        ))
      )
      return results.flat().sort((a, b) => new Date(b.date) - new Date(a.date))
    },
    enabled: pets.length > 0
  })

  const addExpense = useMutation({
    mutationFn: payload => api.post('/expenses', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses-all'] })
      setShowModal(false)
    }
  })

  const deleteExpense = useMutation({
    mutationFn: id => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses-all'] })
  })

  const filtered = filterPet === 'all' ? allExpenses : allExpenses.filter(e => String(e.pet_id) === filterPet)
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-brand text-2xl font-extrabold text-pine-900 md:text-3xl">財務管理</h1>
          <p className="mt-1 text-sm text-ink-soft">記錄每隻寵物的花費</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/expense-report"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e8d9bd] bg-plate px-3.5 py-2.5 text-sm font-bold text-pine-800 transition-colors hover:bg-[#fdf6ea]"
          >
            <LineIcon name="chart" size={15} />
            查看報表
          </Link>
          <button
            onClick={() => setShowModal(true)}
            disabled={pets.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#f5c04a] px-4 py-2.5 text-sm font-extrabold text-pine-900 shadow-[0_5px_0_#c96f2e] transition-all hover:bg-[#f0b23a] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
          >
            <LineIcon name="plus" size={15} />
            新增支出
          </button>
        </div>
      </div>

      {/* 篩選 + 總計 */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select value={filterPet} onChange={e => setFilterPet(e.target.value)} className={`${fieldCls} w-auto min-w-32`}>
          <option value="all">全部寵物</option>
          {pets.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2.5 rounded-2xl border border-[#f3e3cd] bg-plate px-4 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fff3d6] text-[#c96f2e]">
            <LineIcon name="wallet" size={16} />
          </span>
          <div>
            <p className="text-[11px] text-ink-soft">總支出</p>
            <p className="font-brand text-base font-extrabold tabular-nums text-pine-900">{twd(total)}</p>
          </div>
        </div>
      </div>

      {showModal && pets.length > 0 && (
        <AddExpenseModal
          pets={pets}
          onClose={() => setShowModal(false)}
          onSave={data => addExpense.mutate(data)}
          saving={addExpense.isPending}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#faf7ef]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#e8d9bd] bg-[#faf7ef] px-4 py-16 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-plate text-pine-700">
            <LineIcon name="wallet" size={26} />
          </span>
          <p className="mt-3 text-sm font-semibold text-pine-900">還沒有支出記錄</p>
          <p className="mt-1 text-xs text-ink-soft">新增第一筆，就能在報表裡看到花費分布。</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map(exp => (
            <li
              key={exp.id}
              className="flex items-center gap-3.5 rounded-2xl border border-[#f3e3cd] bg-plate px-4 py-3.5 transition-colors hover:bg-[#fffdf6]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
                <LineIcon name={exp.category} size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-pine-900">{exp.title}</p>
                <p className="mt-0.5 truncate text-xs text-ink-soft">
                  {exp.pet_name} ・ {CAT_MAP[exp.category] || exp.category} ・ {exp.date?.slice(0, 10)}
                </p>
                {exp.notes && <p className="mt-0.5 truncate text-xs text-ink-soft/80">注：{exp.notes}</p>}
              </div>
              <p className="shrink-0 font-brand text-base font-extrabold tabular-nums text-pine-800">
                {twd(exp.amount)}
              </p>
              <button
                onClick={() => { if (confirm('確定刪除？')) deleteExpense.mutate(exp.id) }}
                disabled={deleteExpense.isPending}
                aria-label={`刪除 ${exp.title}`}
                className="shrink-0 rounded-lg p-2 text-ink-soft/60 transition-colors hover:bg-[#fdeee6] hover:text-[#b4552f] disabled:opacity-50"
              >
                <LineIcon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {addExpense.isError && (
        <p role="alert" className="mt-3 text-xs text-[#b4552f]">
          {addExpense.error?.response?.data?.error || '新增失敗，請稍後再試'}
        </p>
      )}
      {deleteExpense.isError && (
        <p role="alert" className="mt-3 text-xs text-[#b4552f]">刪除失敗，請稍後再試</p>
      )}
    </div>
  )
}
