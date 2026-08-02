import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts'
import { api } from '../lib/api'

const COLORS = ['#f97316','#22c55e','#3b82f6','#a855f7','#ec4899','#eab308']

const CAT_LABEL = {
  food:'飼料/零食', medical:'醫療/疫苗', grooming:'美容/洗澡',
  toy:'玩具/用品', boarding:'寄宿/托育', other:'其他'
}

const CAT_EMOJI = {
  food:'🍖', medical:'🏥', grooming:'✂️',
  toy:'🎾', boarding:'🏠', other:'📦'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 px-4 py-3 text-sm">
      {label && <p className="font-bold text-gray-600 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: RM {Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  )
}

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={13} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function ExpenseReportPage() {
  const { data: summary = [], isLoading: loadingSummary } = useQuery({
    queryKey: ['expenses-summary'],
    queryFn: () => api.get('/expenses/summary').then(r => r.data.data)
  })

  const { data: monthly = [], isLoading: loadingMonthly } = useQuery({
    queryKey: ['expenses-monthly'],
    queryFn: () => api.get('/expenses/monthly').then(r => r.data.data)
  })

  const categoryData = Object.entries(
    summary.reduce((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + Number(row.total)
      return acc
    }, {})
  ).map(([cat, total]) => ({
    name: CAT_LABEL[cat] || cat,
    emoji: CAT_EMOJI[cat] || '📦',
    value: total,
    key: cat
  })).sort((a, b) => b.value - a.value)

  const petNames = [...new Set(monthly.map(r => r.pet_name))]

  const petTotals = Object.entries(
    summary.reduce((acc, row) => {
      acc[row.pet_name] = (acc[row.pet_name] || 0) + Number(row.total)
      return acc
    }, {})
  ).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)

  const monthlyGrouped = Object.entries(
    monthly.reduce((acc, row) => {
      if (!acc[row.month]) acc[row.month] = { month: row.month }
      acc[row.month][row.pet_name] = Number(row.total)
      return acc
    }, {})
  ).map(([, v]) => v).sort((a, b) => a.month.localeCompare(b.month))

  const total = summary.reduce((s, r) => s + Number(r.total), 0)
  const topCat = categoryData[0]
  const topPet = petTotals[0]

  const isLoading = loadingSummary || loadingMonthly

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/expenses" className="w-9 h-9 flex items-center justify-center rounded-xl border border-green-200 text-green-400 hover:bg-green-50 transition-colors text-lg">
          ←
        </Link>
        <div>
          <h1 style={{fontFamily:'Nunito,sans-serif'}} className="text-3xl font-black text-gray-800">支出報表</h1>
          <p className="text-gray-400 text-sm mt-0.5">所有寵物的財務統計總覽</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="text-5xl mb-4 animate-bounce">📊</div>
            <p className="text-gray-400">載入報表中...</p>
          </div>
        </div>
      ) : summary.length === 0 ? (
        <div className="text-center py-32">
          <div className="text-7xl mb-5">💸</div>
          <p className="text-gray-400 text-lg mb-2">還沒有支出資料</p>
          <p className="text-gray-300 text-sm mb-6">先去記錄一些寵物花費吧！</p>
          <Link to="/expenses"
            className="inline-block bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">
            前往新增支出
          </Link>
        </div>
      ) : (
        <div className="space-y-6">

          {/* 統計卡片 */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: '總支出', value: `RM ${total.toFixed(2)}`, color: 'text-green-500', bg: 'bg-green-50', icon: '💰' },
              { label: '寵物數量', value: `${petNames.length} 隻`, color: 'text-blue-500', bg: 'bg-blue-50', icon: '🐾' },
              { label: '最高花費', value: topPet ? topPet.name : '—', color: 'text-purple-500', bg: 'bg-purple-50', icon: '🏆' },
              { label: '最多類別', value: topCat ? topCat.emoji + ' ' + topCat.name : '—', color: 'text-green-500', bg: 'bg-green-50', icon: '📂' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center text-xl mb-3`}>
                  {card.icon}
                </div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{card.label}</p>
                <p style={{fontFamily:'Nunito,sans-serif'}} className={`text-xl font-black mt-1 ${card.color}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* 圓餅圖 + 類別明細 */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 style={{fontFamily:'Nunito,sans-serif'}} className="text-lg font-black text-gray-700 mb-5">支出類別分布</h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={100}
                    labelLine={false} label={CustomPieLabel}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 類別明細列表 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 style={{fontFamily:'Nunito,sans-serif'}} className="text-lg font-black text-gray-700 mb-5">類別明細</h2>
              <div className="space-y-3">
                {categoryData.map((d, i) => {
                  const pct = total > 0 ? (d.value / total) * 100 : 0
                  return (
                    <div key={d.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}} />
                          <span className="text-sm text-gray-600">{d.emoji} {d.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-800">RM {d.value.toFixed(2)}</span>
                          <span className="text-xs text-gray-400 ml-2">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 每隻寵物花費 */}
          {petTotals.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 style={{fontFamily:'Nunito,sans-serif'}} className="text-lg font-black text-gray-700 mb-5">每隻寵物花費比較</h2>
              <div className="grid grid-cols-2 gap-6 items-center">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={petTotals} margin={{top:5, right:10, left:0, bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{fontSize:12, fill:'#9ca3af'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize:11, fill:'#9ca3af'}} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="總花費" radius={[8,8,0,0]}>
                      {petTotals.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-3">
                  {petTotals.map((p, i) => {
                    const pct = total > 0 ? (p.total / total) * 100 : 0
                    return (
                      <div key={p.name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                          style={{backgroundColor: COLORS[i % COLORS.length]}}>
                          {p.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-700 truncate">{p.name}</span>
                            <span className="text-sm font-bold text-gray-800 ml-2 shrink-0">RM {Number(p.total).toFixed(2)}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 月度趨勢 */}
          {monthlyGrouped.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 style={{fontFamily:'Nunito,sans-serif'}} className="text-lg font-black text-gray-700 mb-5">月度支出趨勢</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyGrouped} margin={{top:5, right:20, left:0, bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{fontSize:12, fill:'#9ca3af'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:11, fill:'#9ca3af'}} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {petNames.map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name}
                      stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
                      dot={{ fill: COLORS[i % COLORS.length], r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}
    </div>
  )
}