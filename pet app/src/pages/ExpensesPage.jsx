import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  BracketTitle,
  Tag,
  CornerBrackets
} from '@endfield-ui/react'
import {
  Wallet,
  Plus,
  Trash2,
  PieChart,
  Utensils,
  Stethoscope,
  Scissors,
  Gamepad2,
  Home,
  Package,
  Calendar,
  X,
  Tag as TagIcon
} from 'lucide-react'
import { api } from '../lib/api'

const CATEGORIES = [
  { value: 'food',     label: '飼料/零食', icon: Utensils },
  { value: 'medical',  label: '醫療/疫苗', icon: Stethoscope },
  { value: 'grooming', label: '美容/洗澡', icon: Scissors },
  { value: 'toy',      label: '玩具/用品', icon: Gamepad2 },
  { value: 'boarding', label: '寄宿/托育', icon: Home },
  { value: 'other',    label: '其他支出', icon: Package },
]

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))
const CAT_ICON = Object.fromEntries(CATEGORIES.map(c => [c.value, c.icon]))

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

  return createPortal(
    <div className="fixed inset-0 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" data-theme="light">
      <div className="relative bg-white border border-[#d9d9d9] shadow-2xl p-6 w-full max-w-lg">
        <CornerBrackets size="md" />

        {/* 標題欄 */}
        <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-4 bg-[#fffa00]" />
            <span className="font-extrabold text-base tracking-wider text-[#191919]">新增支出紀錄</span>
            <span className="text-[10px] text-[#8a8a8a] font-mono">// NEW_ENTRY</span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-7 h-7 flex items-center justify-center border border-[#e5e5e5] text-[#8a8a8a] hover:text-[#191919] hover:border-[#191919] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave({ ...form, amount: Number(form.amount) }) }}
          className="space-y-4">

          {/* 選擇寵物 */}
          <div>
            <label className="text-[11px] font-mono text-[#8a8a8a] mb-1.5 block uppercase tracking-wider">
              歸屬寵物 / PET TARGET
            </label>
            <select
              value={form.petId}
              onChange={e => set('petId', e.target.value)}
              className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-2 text-sm text-[#191919] font-mono focus:border-[#191919] focus:outline-hidden transition-colors"
            >
              {pets.map(p => <option key={p.id} value={p.id}>{p.name} ({p.species === 'dog' ? '犬' : p.species === 'cat' ? '貓' : p.species})</option>)}
            </select>
          </div>

          {/* 類別選擇 */}
          <div>
            <label className="text-[11px] font-mono text-[#8a8a8a] mb-1.5 block uppercase tracking-wider">
              支出類別 / CATEGORY
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon
                const active = form.category === cat.value
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => set('category', cat.value)}
                    className={`py-2 px-2 text-xs font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-[#191919] text-[#fffa00] border-[#191919] font-bold shadow-xs'
                        : 'bg-[#fafafa] border-[#e5e5e5] text-[#555] hover:border-[#191919] hover:text-[#191919]'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 支出名稱 */}
          <div>
            <label className="text-[11px] font-mono text-[#8a8a8a] mb-1.5 block uppercase tracking-wider">
              項目名稱 / TITLE *
            </label>
            <input
              required
              placeholder="例如：皇家幼犬飼料 3kg、年度疫苗施打..."
              value={form.title}
              onChange={e => set('title', e.target.value)}
              className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-2 text-sm text-[#191919] focus:border-[#191919] focus:outline-hidden transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-[#8a8a8a] mb-1.5 block uppercase tracking-wider">
                金額 / AMOUNT (TWD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-2 text-sm text-[#191919] font-mono focus:border-[#191919] focus:outline-hidden transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-[#8a8a8a] mb-1.5 block uppercase tracking-wider">
                交易日期 / DATE *
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-2 text-sm text-[#191919] font-mono focus:border-[#191919] focus:outline-hidden transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-mono text-[#8a8a8a] mb-1.5 block uppercase tracking-wider">
              備註說明 / NOTES
            </label>
            <textarea
              placeholder="可填寫購買通路、品牌規格或醫生建議事項..."
              value={form.notes}
              rows={2}
              onChange={e => set('notes', e.target.value)}
              className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-2 text-sm text-[#191919] focus:border-[#191919] focus:outline-hidden transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-[#e5e5e5]">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 border border-[#d9d9d9] py-2 text-xs"
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="action"
              disabled={saving}
              className="flex-1 py-2 text-xs"
            >
              {saving ? '儲存中...' : '確認新增'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses-all'] }); setShowModal(false) }
  })

  const deleteExpense = useMutation({
    mutationFn: id => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses-all'] })
  })

  const filtered = filterPet === 'all' ? allExpenses : allExpenses.filter(e => String(e.pet_id) === filterPet)
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6" data-theme="light">
      {/* 頂部導航與標題 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-5">
        <div>
          <BracketTitle prefix="// FINANCIAL.LOG">財務管理</BracketTitle>
          <p className="text-xs font-mono text-[#8a8a8a] mt-1 tracking-wider">
            追蹤每隻毛孩的日常生活花費、醫療與健康預算明細
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/expense-report">
            <Button variant="ghost" className="border border-[#d9d9d9] bg-white hover:border-[#191919] text-xs py-2 px-3 flex items-center gap-1.5">
              <PieChart size={14} />
              <span>支出統計報表</span>
            </Button>
          </Link>
          <Button
            variant="action"
            onClick={() => setShowModal(true)}
            disabled={pets.length === 0}
            className="text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>新增支出</span>
          </Button>
        </div>
      </div>

      {/* 篩選與數據摘要列 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 寵物篩選 */}
        <div className="relative bg-white border border-[#d9d9d9] p-4 flex flex-col justify-between">
          <CornerBrackets size="sm" />
          <div className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wider mb-2">
            篩選對象 / TARGET FILTER
          </div>
          <select
            value={filterPet}
            onChange={e => setFilterPet(e.target.value)}
            className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-2 text-sm text-[#191919] font-medium focus:border-[#191919] focus:outline-hidden transition-colors"
          >
            <option value="all">全部寵物 ({allExpenses.length} 筆)</option>
            {pets.map(p => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* 紀錄筆數 */}
        <div className="relative bg-white border border-[#d9d9d9] p-4 flex flex-col justify-between">
          <CornerBrackets size="sm" />
          <div className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wider mb-1">
            已列出紀錄數 / RECORD COUNT
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-black text-[#191919]">
              {filtered.length}
            </span>
            <span className="text-xs font-mono text-[#8a8a8a]">ENTRIES</span>
          </div>
        </div>

        {/* 累計支出 */}
        <div className="relative bg-white border border-[#d9d9d9] p-4 flex flex-col justify-between">
          <CornerBrackets size="sm" />
          <div className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>累計支出總額 / TOTAL SUM</span>
            <span className="inline-block w-2 h-2 bg-[#fffa00]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-mono text-[#8a8a8a]">TWD</span>
            <span className="text-2xl font-mono font-black text-[#191919]">
              {total.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
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

      {/* 支出記錄清單 */}
      {isLoading ? (
        <div className="border border-[#d9d9d9] bg-white p-12 text-center text-xs font-mono text-[#8a8a8a]">
          讀取支出紀錄資料中... // LOADING_EXPENSES
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative border border-[#d9d9d9] bg-white p-16 text-center">
          <CornerBrackets size="sm" />
          <div className="w-12 h-12 bg-[#f5f5f5] border border-[#e5e5e5] mx-auto flex items-center justify-center text-[#8a8a8a] mb-3">
            <Wallet size={24} />
          </div>
          <p className="font-bold text-sm text-[#191919]">目前尚無支出記錄</p>
          <p className="text-xs text-[#8a8a8a] mt-1 font-mono">點擊上方「新增支出」為毛孩建立第一筆生活紀錄</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(exp => {
            const Icon = CAT_ICON[exp.category] || Package
            const catLabel = CAT_MAP[exp.category] || exp.category
            return (
              <div
                key={exp.id}
                className="relative bg-white border border-[#e5e5e5] hover:border-[#191919] p-4 transition-colors flex items-center gap-4 group"
              >
                <CornerBrackets size="sm" />

                {/* 類別圖示 */}
                <div className="w-10 h-10 bg-[#f8f8f8] border border-[#e5e5e5] group-hover:border-[#191919] flex items-center justify-center text-[#191919] shrink-0 transition-colors">
                  <Icon size={18} />
                </div>

                {/* 項目詳情 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#191919] truncate">{exp.title}</span>
                    <Tag size="sm" variant="default" className="font-mono text-[10px]">
                      {exp.pet_name}
                    </Tag>
                    <Tag size="sm" variant="default" className="text-[10px] bg-[#f5f5f5] border-[#e5e5e5]">
                      {catLabel}
                    </Tag>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#8a8a8a] font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {exp.date?.slice(0, 10)}
                    </span>
                    {exp.notes && (
                      <span className="truncate max-w-md text-[#555]">
                        // {exp.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* 金額 */}
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono text-[#8a8a8a] mr-1">TWD</span>
                  <span className="font-mono font-black text-lg text-[#191919]">
                    {Number(exp.amount).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 刪除按鈕 */}
                <button
                  type="button"
                  title="刪除紀錄"
                  onClick={() => {
                    if (window.confirm(`確定要刪除「${exp.title}」這筆記錄嗎？`)) {
                      deleteExpense.mutate(exp.id)
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center border border-transparent text-[#b0b0b0] hover:text-[#d93025] hover:border-[#d93025] hover:bg-[#fff5f5] transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}