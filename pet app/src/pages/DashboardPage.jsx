import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

const EMOJI = { dog:'🐶', cat:'🐱', bird:'🐦', rabbit:'🐰', fish:'🐟', other:'🐾' }

function StatCard({ label, value, unit, sub, subColor = 'text-green-600', icon, iconBg }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center text-base`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-800 mb-1">
        {value} <span className="text-sm font-normal text-gray-400">{unit}</span>
      </div>
      <div className={`text-xs font-medium ${subColor} flex items-center gap-1`}>{sub}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { data: pets = [], isLoading } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  const { data: expSummary = [] } = useQuery({
    queryKey: ['expenses-summary'],
    queryFn: () => api.get('/expenses/summary').then(r => r.data.data)
  })

  const totalExpense = expSummary.reduce((s, r) => s + Number(r.total), 0)

  const hour = new Date().getHours()
  const greeting = hour < 5 ? '夜深了' : hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安'

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">{greeting}，{user?.name} 👋</h1>
        <p className="text-sm text-gray-400 mt-0.5">歡迎回到 PawCare，今天你的毛孩子們還好嗎？</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="寵物總數" value={pets.length} unit="隻"
          sub="✓ 全部健康" icon="🐾" iconBg="bg-green-50" />
        <StatCard label="本月支出" value={`RM ${totalExpense.toFixed(0)}`} unit=""
          sub="💰 點擊查看明細" icon="💳" iconBg="bg-blue-50" subColor="text-blue-500" />
        <StatCard label="健康記錄" value="—" unit=""
          sub="即將推出" icon="📋" iconBg="bg-amber-50" subColor="text-amber-500" />
        <StatCard label="即將到期" value="—" unit=""
          sub="無待辦事項" icon="🔔" iconBg="bg-gray-50" subColor="text-gray-400" />
      </div>

      {/* Pets */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🐶</span>
            <h2 className="text-sm font-semibold text-gray-800">我的寵物</h2>
          </div>
          <Link to="/pets" className="text-xs text-green-500 font-semibold hover:underline">查看全部 →</Link>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-300 py-4">載入中...</p>
        ) : pets.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-3xl mb-2">🐾</p>
            <p className="text-sm text-gray-400 mb-3">還沒有寵物</p>
            <Link to="/pets" className="inline-block bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
              新增第一隻寵物
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {pets.map(pet => (
              <Link key={pet.id} to={`/pets/${pet.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-green-200 hover:bg-green-50 transition-all group">
                <span className="text-2xl group-hover:scale-110 transition-transform">{EMOJI[pet.species] || '🐾'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{pet.name}</p>
                  <p className="text-xs text-gray-400 truncate">{pet.breed || pet.species}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/expenses"
          className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-green-200 hover:shadow-sm transition-all group">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-xl group-hover:bg-green-100 transition-colors">💰</div>
          <div>
            <p className="text-sm font-semibold text-gray-800">財務管理</p>
            <p className="text-xs text-gray-400">記錄寵物花費</p>
          </div>
        </Link>
        <Link to="/expense-report"
          className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-green-200 hover:shadow-sm transition-all group">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl group-hover:bg-blue-100 transition-colors">📊</div>
          <div>
            <p className="text-sm font-semibold text-gray-800">支出報表</p>
            <p className="text-xs text-gray-400">查看統計圖表</p>
          </div>
        </Link>
      </div>
    </div>
  )
}