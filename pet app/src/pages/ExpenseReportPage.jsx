import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts'
import {
  BracketTitle,
  CornerBrackets,
  Button,
  Tag
} from '@endfield-ui/react'
import {
  ArrowLeft,
  Wallet,
  PawPrint,
  Award,
  Folder,
  Utensils,
  Stethoscope,
  Scissors,
  Gamepad2,
  Home,
  Package,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { api } from '../lib/api'

// 工業科技風格高辨識度配色
const COLORS = ['#191919', '#d97706', '#2563eb', '#059669', '#7c3aed', '#dc2626']

const CAT_CONFIG = {
  food:     { label: '飼料/零食', icon: Utensils },
  medical:  { label: '醫療/疫苗', icon: Stethoscope },
  grooming: { label: '美容/洗澡', icon: Scissors },
  toy:      { label: '玩具/用品', icon: Gamepad2 },
  boarding: { label: '寄宿/托育', icon: Home },
  other:    { label: '其他支出', icon: Package }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#191919] p-3 text-xs shadow-lg font-mono">
      {label && <p className="font-bold text-[#191919] mb-1.5 border-b border-[#e5e5e5] pb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}:</span>
          <span className="font-bold text-[#191919]">
            TWD {Number(p.value).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
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
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight="700"
      fontFamily="monospace"
    >
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
    name: CAT_CONFIG[cat]?.label || cat,
    icon: CAT_CONFIG[cat]?.icon || Package,
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
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6" data-theme="light">
      {/* 頂部導航與標題 */}
      <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/expenses"
            className="w-9 h-9 flex items-center justify-center border border-[#d9d9d9] bg-white text-[#191919] hover:bg-[#191919] hover:text-[#fffa00] hover:border-[#191919] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <BracketTitle prefix="// FINANCIAL.ANALYTICS">支出報表</BracketTitle>
            <p className="text-xs font-mono text-[#8a8a8a] mt-1 tracking-wider">
              寵物生活支出統計與趨勢可視化分析
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="border border-[#d9d9d9] bg-white p-16 text-center text-xs font-mono text-[#8a8a8a]">
          讀取統計數據中... // LOADING_CHART_METRICS
        </div>
      ) : summary.length === 0 ? (
        <div className="relative border border-[#d9d9d9] bg-white p-16 text-center">
          <CornerBrackets size="sm" />
          <div className="w-12 h-12 bg-[#f5f5f5] border border-[#e5e5e5] mx-auto flex items-center justify-center text-[#8a8a8a] mb-3">
            <BarChart3 size={24} />
          </div>
          <p className="font-bold text-sm text-[#191919]">目前尚無支出資料可供統計</p>
          <p className="text-xs text-[#8a8a8a] mt-1 font-mono mb-5">請先於財務管理頁面記錄毛孩的生活花費</p>
          <Link to="/expenses">
            <Button variant="action" className="text-xs py-2 px-4">
              前往新增支出
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 四欄 KPI 摘要指標 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 總支出 */}
            <div className="relative bg-white border border-[#d9d9d9] p-4">
              <CornerBrackets size="sm" />
              <div className="flex items-center justify-between text-[#8a8a8a] mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider">總支出額 / TOTAL</span>
                <Wallet size={14} className="text-[#191919]" />
              </div>
              <div className="text-xl font-mono font-black text-[#191919]">
                ${total.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* 記錄寵物數量 */}
            <div className="relative bg-white border border-[#d9d9d9] p-4">
              <CornerBrackets size="sm" />
              <div className="flex items-center justify-between text-[#8a8a8a] mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider">寵物數量 / PETS</span>
                <PawPrint size={14} className="text-[#191919]" />
              </div>
              <div className="text-xl font-mono font-black text-[#191919]">
                {petNames.length} <span className="text-xs font-normal text-[#8a8a8a]">隻</span>
              </div>
            </div>

            {/* 最高花費寵物 */}
            <div className="relative bg-white border border-[#d9d9d9] p-4">
              <CornerBrackets size="sm" />
              <div className="flex items-center justify-between text-[#8a8a8a] mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider">最高花費對象 / TOP PET</span>
                <Award size={14} className="text-[#191919]" />
              </div>
              <div className="text-xl font-bold text-[#191919] truncate">
                {topPet ? topPet.name : '—'}
              </div>
            </div>

            {/* 最高支出類別 */}
            <div className="relative bg-white border border-[#d9d9d9] p-4">
              <CornerBrackets size="sm" />
              <div className="flex items-center justify-between text-[#8a8a8a] mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider">最高支出類別 / TOP CAT</span>
                <Folder size={14} className="text-[#191919]" />
              </div>
              <div className="text-xl font-bold text-[#191919] truncate">
                {topCat ? topCat.name : '—'}
              </div>
            </div>
          </div>

          {/* 圓餅圖 + 類別明細 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 類別分布圖 */}
            <div className="relative bg-white border border-[#d9d9d9] p-5">
              <CornerBrackets size="sm" />
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-4">
                <span className="font-bold text-sm text-[#191919]">支出類別分布</span>
                <span className="text-[10px] font-mono text-[#8a8a8a]">// PIE_SHARE</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    labelLine={false}
                    label={CustomPieLabel}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 類別明細進度條列表 */}
            <div className="relative bg-white border border-[#d9d9d9] p-5">
              <CornerBrackets size="sm" />
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-4">
                <span className="font-bold text-sm text-[#191919]">類別花費明細</span>
                <span className="text-[10px] font-mono text-[#8a8a8a]">// BREAKDOWN</span>
              </div>
              <div className="space-y-3.5">
                {categoryData.map((d, i) => {
                  const pct = total > 0 ? (d.value / total) * 100 : 0
                  const Icon = d.icon
                  return (
                    <div key={d.key}>
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <Icon size={13} className="text-[#191919]" />
                          <span className="font-medium text-[#191919]">{d.name}</span>
                        </div>
                        <div className="font-mono text-right">
                          <span className="font-bold text-[#191919]">
                            ${d.value.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-[#8a8a8a] ml-2">
                            ({pct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-[#f0f0f0] overflow-hidden">
                        <div
                          className="h-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 每隻寵物花費比較 */}
          {petTotals.length > 0 && (
            <div className="relative bg-white border border-[#d9d9d9] p-5">
              <CornerBrackets size="sm" />
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-4">
                <span className="font-bold text-sm text-[#191919]">每隻寵物花費比較</span>
                <span className="text-[10px] font-mono text-[#8a8a8a]">// PET_COMPARISON</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={petTotals} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#e5e5e5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#191919' }} axisLine={{ stroke: '#d9d9d9' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#8a8a8a', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="總花費">
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
                        <div
                          className="w-7 h-7 flex items-center justify-center text-white text-xs font-mono font-bold shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        >
                          {p.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1 text-xs">
                            <span className="font-bold text-[#191919] truncate">{p.name}</span>
                            <span className="font-mono font-bold text-[#191919]">
                              ${Number(p.total).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#f0f0f0] overflow-hidden">
                            <div
                              className="h-full"
                              style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 月度支出趨勢 */}
          {monthlyGrouped.length > 0 && (
            <div className="relative bg-white border border-[#d9d9d9] p-5">
              <CornerBrackets size="sm" />
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-4">
                <span className="font-bold text-sm text-[#191919]">月度支出趨勢</span>
                <span className="text-[10px] font-mono text-[#8a8a8a]">// MONTHLY_TREND</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyGrouped} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#e5e5e5" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#191919', fontFamily: 'monospace' }} axisLine={{ stroke: '#d9d9d9' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8a8a8a', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }} />
                  {petNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: COLORS[i % COLORS.length], r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
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