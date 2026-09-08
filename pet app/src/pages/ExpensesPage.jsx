import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

const CATEGORIES = [
  { value: 'food',     label: '🍖 飼料/零食' },
  { value: 'medical',  label: '🏥 醫療/疫苗' },
  { value: 'grooming', label: '✂️ 美容/洗澡' },
  { value: 'toy',      label: '🎾 玩具/用品' },
  { value: 'boarding', label: '🏠 寄宿/托育' },
  { value: 'other',    label: '📦 其他' },
]

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{fontFamily:'Nunito,sans-serif'}} className="text-xl font-black">新增支出 💰</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl">✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave({ ...form, amount: Number(form.amount) }) }}
          className="space-y-3">

          {/* 選擇寵物 */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">選擇寵物</label>
            <select value={form.petId} onChange={e => set('petId', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
              {pets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* 類別 */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">類別</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button"
                  onClick={() => set('category', cat.value)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all ${
                    form.category === cat.value
                      ? 'bg-green-500 text-white border-green-500'
                      : 'border-gray-200 text-gray-500 hover:border-green-300'
                  }`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <input required placeholder="支出名稱 *" value={form.title}
            onChange={e => set('title', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">金額 (RM)</label>
              <input type="number" step="0.01" min="0" required value={form.amount}
                onChange={e => set('amount', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">日期</label>
              <input type="date" required value={form.date}
                onChange={e => set('date', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          <textarea placeholder="備注（選填）" value={form.notes} rows={2}
            onChange={e => set('notes', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50">
              取消
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
              {saving ? '新增中...' : '新增'}
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses-all'] }); setShowModal(false) }
  })

  const deleteExpense = useMutation({
    mutationFn: id => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses-all'] })
  })

  const filtered = filterPet === 'all' ? allExpenses : allExpenses.filter(e => String(e.pet_id) === filterPet)
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{fontFamily:'Nunito,sans-serif'}} className="text-3xl font-black text-gray-800">財務管理</h1>
          <p className="text-gray-400 text-sm mt-1">記錄每隻寵物的花費</p>
        </div>
        <div className="flex gap-3">
          <a href="/expense-report"
            className="border border-green-300 text-green-500 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-green-50 transition-colors">
            📊 查看報表
          </a>
          <button onClick={() => setShowModal(true)} disabled={pets.length === 0}
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40">
            ＋ 新增支出
          </button>
        </div>
      </div>

      {/* 篩選 + 總計 */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select value={filterPet} onChange={e => setFilterPet(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
          <option value="all">全部寵物</option>
          {pets.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        <div className="ml-auto bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-200">
          <span className="text-xs text-gray-400">總支出</span>
          <span style={{fontFamily:'Nunito,sans-serif'}} className="text-xl font-black text-green-500 ml-2">
            RM {total.toFixed(2)}
          </span>
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

      {/* List */}
      {isLoading ? (
        <p className="text-gray-300 text-sm">載入中...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-300">
          <p className="text-6xl mb-4">💸</p>
          <p>還沒有支出記錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(exp => (
            <div key={exp.id} className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="text-2xl">{CATEGORIES.find(c => c.value === exp.category)?.label.split(' ')[0] || '📦'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{exp.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                    {exp.pet_name} · {CAT_MAP[exp.category] || exp.category} · {exp.date?.slice(0,10)}
                </p>
                {exp.notes && (
                    <p className="text-xs text-gray-500 mt-0.5">注：{exp.notes}</p>
                )}
              </div>
              <p style={{fontFamily:'Nunito,sans-serif'}} className="font-black text-green-500 text-lg shrink-0">
                RM {Number(exp.amount).toFixed(2)}
              </p>
              <button onClick={() => { if(confirm('確定刪除？')) deleteExpense.mutate(exp.id) }}
                className="text-gray-200 hover:text-red-400 transition-colors text-lg shrink-0">🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}