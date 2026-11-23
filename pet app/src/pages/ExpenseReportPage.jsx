import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts'
import { api } from '../lib/api'

const COLORS = ['#c96f2e', '#2c5a43', '#3f6b7a', '#7a5a9e', '#b4552f', '#e8a33d']

const CAT_LABEL = {
  food: '飼料 / 零食', medical: '醫療 / 疫苗', grooming: '美容 / 洗澡',
  toy: '玩具 / 用品', boarding: '寄宿 / 托育', other: '其他'
}

const ICON = {
  wallet: <><path d="M4 7.5h13.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5a1.5 1.5 0 0 1-1.5-1.5V7.5Z" /><path d="M4 7.5V6a1.5 1.5 0 0 1 1.5-1.5H16" /><circle cx="15.5" cy="13.5" r="1" fill="currentColor" stroke="none" /></>,
  paw: <><ellipse cx="7" cy="8" rx="2" ry="2.4" /><ellipse cx="12" cy="5.8" rx="2" ry="2.4" /><ellipse cx="17" cy="8" rx="2" ry="2.4" /><path d="M12 11c-3 0-5.5 2.2-5.5 4.8 0 1.7 1.4 2.9 3 2.9 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-1.2 3-2.9C17.5 13.2 15 11 12 11Z" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 5.5H5.5v1.5a3 3 0 0 0 3 3M16 5.5h2.5v1.5a3 3 0 0 1-3 3" /><path d="M12 13v3M9 19h6M10 16h4" /></>,
  folder: <><path d="M4 7.5h5l1.5 2H20V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V7.5Z" /><path d="M4 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4L11 6.5" /></>,
  chart: <><path d="M4 20V5M4 20h16" /><path d="M7.5 16l3.5-4 3 2 4.5-6" /></>,
  back: <path d="M15 6l-6 6 6 6" />
}

function LineIcon({ name, size = 16 }) {
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
      className="shrink-0"
    >
      {ICON[name] || ICON.folder}
    </svg>
  )
}

const cardCls = 'min-w-0 rounded-3xl border border-hair bg-plate p-4 sm:p-5'
const sectionTitle = 'mb-4 text-base font-bold text-pine-900'
const axisTick = { fontSize: 11, fill: '#8e978d' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-hair bg-plate px-3.5 py-2.5 text-xs shadow-[0_12px_24px_-16px_rgba(87,54,17,0.5)]">
      {label && <p className="mb-1 font-bold text-pine-900">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold tabular-nums" style={{ color: p.color }}>
          {p.name}: TWD {Number(p.value).toFixed(2)}
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
    <text x={x} y={y} fill="#fffdf6" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="bold">
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
      <PageHeader
        back={{ to: '/expenses', label: '返回財務管理' }}
        title="支出"
        accent="報表"
        subtitle="所有寵物的財務統計總覽"
      />

      {isLoading ? (
        <LoadingState label="載入報表中…" />
      ) : summary.length === 0 ? (
        <EmptyState
          icon="chart"
          title="還沒有支出資料"
          desc="先去記錄一些寵物花費吧！"
          action={{ label: '前往新增支出', to: '/expenses' }}
        />
      ) : (
        <div className="space-y-5">
          {/* 統計卡片 */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { label: '總支出', value: `TWD ${total.toFixed(2)}`, icon: 'wallet' },
              { label: '寵物數量', value: `${petNames.length} 隻`, icon: 'paw' },
              { label: '最高花費', value: topPet ? topPet.name : '—', icon: 'trophy' },
              { label: '最多類別', value: topCat ? topCat.name : '—', icon: 'folder' }
            ].map((card, i) => (
              <div key={card.label} className={cardCls}>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${i % 2 === 0 ? 'bg-honey-100 text-honey-deep' : 'bg-pine-50 text-pine-700'}`}
                >
                  <LineIcon name={card.icon} size={19} />
                </span>
                <p className="mt-3 text-xs font-semibold text-ink-soft">{card.label}</p>
                <p className="mt-1 break-words font-brand text-base font-extrabold text-pine-900 sm:text-xl">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* 圓餅圖 + 類別明細 */}
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            <div className={cardCls}>
              <h2 className={sectionTitle}>支出類別分布</h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={CustomPieLabel}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className={cardCls}>
              <h2 className={sectionTitle}>類別明細</h2>
              <div className="space-y-3">
                {categoryData.map((d, i) => {
                  const pct = total > 0 ? (d.value / total) * 100 : 0
                  return (
                    <div key={d.key}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="truncate text-sm font-medium text-ink">{d.name}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-sm font-bold tabular-nums text-pine-900">TWD {d.value.toFixed(2)}</span>
                          <span className="ml-2 text-xs tabular-nums text-ink-soft">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-cream">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 每隻寵物花費 */}
          {petTotals.length > 0 && (
            <div className={cardCls}>
              <h2 className={sectionTitle}>每隻寵物花費比較</h2>
              <div className="grid grid-cols-1 items-center gap-4 sm:gap-5 lg:grid-cols-2">
                <div className="min-w-0">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={petTotals} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1ede2" />
                      <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
                      <YAxis width={56} tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="總花費" radius={[8, 8, 0, 0]}>
                        {petTotals.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {petTotals.map((p, i) => {
                    const pct = total > 0 ? (p.total / total) * 100 : 0
                    return (
                      <div key={p.name} className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-plate"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        >
                          {p.name[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-pine-900">{p.name}</span>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-pine-800">TWD {Number(p.total).toFixed(2)}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-cream">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
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
            <div className={cardCls}>
              <h2 className={sectionTitle}>月度支出趨勢</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyGrouped} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1ede2" />
                  <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis width={56} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {petNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ fill: COLORS[i % COLORS.length], r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
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
