import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ResponsiveContainer
} from 'recharts'
import { Scale, TrendingUp, TrendingDown, Minus, Trash2, Calendar, Plus } from 'lucide-react'
import { Tag, CornerBrackets } from '@endfield-ui/react'
import { api } from '../../lib/api'
import { ageInMonths, formatAge } from '../../lib/petAge'
import {
  buildChart, weightTrend, weightNote, formatKg, formatAgeAxis,
  todayString, lifeStage
} from '../../lib/petInsights'

const inputCls =
  'w-full border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#191919] focus:outline-hidden focus:border-[#191919] focus:bg-white transition-colors placeholder:text-[#8a8a8a]'

const BAND_FILL = { young: '#f1f5f9', adult: '#f8fafc', senior: '#fffbeb' }
const HISTORY_PREVIEW = 6

const errorText = err => err?.response?.data?.error || '儲存失敗，請稍後再試'

function WeightTooltip({ active, payload, birthDate }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const months = birthDate ? ageInMonths(birthDate, p.date) : null

  return (
    <div className="border border-[#191919] bg-white px-3 py-2 text-xs shadow-md font-mono">
      <div className="text-[10px] text-[#8a8a8a]">// WEIGHT_LOG</div>
      <p className="font-bold text-sm text-[#191919] mt-0.5">{formatKg(p.weight)} KG</p>
      <p className="text-[#555] text-[11px] mt-0.5">
        {p.date}
        {months !== null && ` // ${formatAge(months)}`}
      </p>
      {p.note && <p className="mt-1 text-[#8a8a8a] border-t border-[#f0f0f0] pt-1">{p.note}</p>}
    </div>
  )
}

export default function WeightCard({ pet }) {
  const qc = useQueryClient()
  const today = todayString()
  const birthDate = pet.birth_date ? String(pet.birth_date).slice(0, 10) : null

  const [mode, setMode] = useState('date')
  const [showAll, setShowAll] = useState(false)
  const [form, setForm] = useState({ weight: '', date: today, note: '' })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['pet-weights', pet.id],
    queryFn: async () => (await api.get(`/pets/${pet.id}/weights`)).data.data
  })

  const refresh = () => qc.invalidateQueries()

  const addWeight = useMutation({
    mutationFn: payload => api.post(`/pets/${pet.id}/weights`, payload),
    onSuccess: () => {
      setForm({ weight: '', date: todayString(), note: '' })
      refresh()
    }
  })

  const removeWeight = useMutation({
    mutationFn: recordId => api.delete(`/pets/${pet.id}/weights/${recordId}`),
    onSuccess: refresh
  })

  const stage = lifeStage(pet.species, birthDate ? ageInMonths(birthDate) : null)

  const dateChart = buildChart(records, { mode: 'date' })
  const ageChart = birthDate ? buildChart(records, { mode: 'age', birthDate }) : null
  const canUseAge = !!ageChart && ageChart.points.length > 0
  const effectiveMode = mode === 'age' && canUseAge ? 'age' : 'date'
  const chart = effectiveMode === 'age' ? ageChart : dateChart

  const trend = weightTrend(records)
  const note = weightNote(trend, stage)
  const latest = records[records.length - 1]

  const history = [...records].reverse().map((r, i, arr) => {
    const prev = arr[i + 1]
    return { ...r, diff: prev ? Math.round((r.weight - prev.weight) * 100) / 100 : null }
  })
  const visibleHistory = showAll ? history : history.slice(0, HISTORY_PREVIEW)

  const submit = e => {
    e.preventDefault()
    addWeight.mutate({
      weight: Number(form.weight),
      date: form.date || today,
      note: form.note.trim() || undefined
    })
  }

  const xTick =
    effectiveMode === 'age'
      ? m => formatAgeAxis(m)
      : ts => {
        const d = new Date(ts)
        const long = chart.xDomain[1] - chart.xDomain[0] > 300 * 86400000
        return long
          ? `${String(d.getUTCFullYear()).slice(2)}/${d.getUTCMonth() + 1}`
          : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
      }

  return (
    <section
      data-theme="light"
      className="relative bg-white border border-[#e5e5e5] p-5 shadow-xs"
      aria-label="體重與成長曲線"
    >
      <CornerBrackets size="sm" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#f0f0f0] pb-3">
        <div>
          <div className="text-[10px] font-mono font-bold tracking-wider text-[#8a8a8a]">
            // WEIGHT_METRICS & GROWTH
          </div>
          <h2 className="text-base font-bold text-[#191919]">體重與成長曲線</h2>
          {latest ? (
            <div className="mt-1 flex items-center gap-2 font-mono text-xs text-[#555]">
              <span>最新記錄:</span>
              <span className="font-bold text-[#191919] bg-[#fffa00] px-1.5 py-0.2 border border-[#191919]">
                {formatKg(latest.weight)} KG
              </span>
              {trend && (
                <span className="flex items-center gap-1 text-[11px] text-[#8a8a8a]">
                  [近 {trend.spanDays} 天{' '}
                  <span
                    className={
                      trend.delta > 0 ? 'text-amber-600 font-bold' : trend.delta < 0 ? 'text-sky-600 font-bold' : 'text-[#8a8a8a]'
                    }
                  >
                    {trend.delta > 0 ? '+' : ''}
                    {formatKg(trend.delta)} kg ({trend.pct > 0 ? '+' : ''}
                    {trend.pct.toFixed(1)}%)
                  </span>
                  ]
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-[#8a8a8a]">登記第一筆體重數據後即可生成成長曲線追蹤圖表</p>
          )}
        </div>

        {canUseAge && (
          <div className="inline-flex shrink-0 border border-[#191919] p-0.5 font-mono text-xs" role="group" aria-label="橫軸切換">
            {[['date', '依日期'], ['age', '依年齡']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={effectiveMode === key}
                onClick={() => setMode(key)}
                className={`px-2.5 py-1 font-bold transition-colors ${
                  effectiveMode === key
                    ? 'bg-[#191919] text-[#fffa00]'
                    : 'bg-white text-[#555] hover:text-[#191919]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {note && (
        <div
          role="status"
          className={`mt-3 px-3 py-2 text-xs border font-mono flex items-center gap-2 ${
            note.level === 'warning'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-[#e5e5e5] bg-[#fafafa] text-[#555]'
          }`}
        >
          <span className="w-1.5 h-1.5 bg-[#191919]" />
          <span>{note.text}</span>
        </div>
      )}

      {/* Chart */}
      {isLoading ? (
        <div className="mt-4 h-[240px] animate-pulse bg-[#fafafa] border border-[#e5e5e5]" />
      ) : records.length > 0 ? (
        <div className="mt-4">
          <div className="h-[240px] w-full" data-testid="weight-chart">
            <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 560, height: 240 }}>
              <LineChart data={chart.points} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#e5e5e5" />
                {effectiveMode === 'age' &&
                  chart.areas.map(a => (
                    <ReferenceArea
                      key={a.key}
                      x1={a.from}
                      x2={a.to}
                      fill={BAND_FILL[a.key]}
                      fillOpacity={0.8}
                      ifOverflow="hidden"
                      label={{ value: a.label, position: 'insideTopLeft', fontSize: 10, fill: '#8a8a8a', fontFamily: 'monospace' }}
                    />
                  ))}
                <XAxis
                  dataKey="x"
                  type="number"
                  scale={effectiveMode === 'date' ? 'time' : 'linear'}
                  domain={chart.xDomain}
                  ticks={chart.ticks}
                  tickFormatter={xTick}
                  tick={{ fontSize: 11, fill: '#8a8a8a', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={{ stroke: '#d9d9d9' }}
                />
                <YAxis
                  domain={chart.yDomain}
                  tickFormatter={formatKg}
                  tick={{ fontSize: 11, fill: '#8a8a8a', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  unit=" kg"
                />
                <Tooltip content={<WeightTooltip birthDate={birthDate} />} />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#191919"
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: '#fffa00', stroke: '#191919', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: '#fffa00', stroke: '#191919', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {effectiveMode === 'age' && (
            <p className="mt-1 font-mono text-[10px] text-[#8a8a8a]">
              // 生命階段參考：未滿 1 歲為幼年期、7 歲起為高齡期，與每日飲食熱量模型同步。
            </p>
          )}
          {records.length === 1 && (
            <p className="mt-2 font-mono text-xs text-[#8a8a8a]">
              * 提示：再增加一筆不同日期的體重紀錄即可繪製成長折線圖。
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 border border-dashed border-[#d9d9d9] bg-[#fafafa] px-4 py-8 text-center text-xs text-[#8a8a8a]">
          <Scale size={24} className="mx-auto mb-2 text-[#8a8a8a] stroke-[1.5]" />
          目前尚無體重測量紀錄。定期追蹤有助於維持毛孩理想體態與及早發現健康警訊。
        </div>
      )}

      {/* 新增體重 Form */}
      <form onSubmit={submit} className="mt-4 border border-[#191919] bg-[#fafafa] p-3">
        <div className="text-[10px] font-mono font-bold tracking-wider text-[#191919] mb-2 flex items-center gap-1.5">
          <Plus size={12} /> RECORD_NEW_WEIGHT
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
          <div>
            <label htmlFor={`w-${pet.id}`} className="sr-only">體重（公斤）</label>
            <input
              id={`w-${pet.id}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max="200"
              required
              value={form.weight}
              onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
              placeholder="體重 (kg) *"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`d-${pet.id}`} className="sr-only">日期</label>
            <input
              id={`d-${pet.id}`}
              type="date"
              required
              max={today}
              min={birthDate || undefined}
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor={`n-${pet.id}`} className="sr-only">備註</label>
            <input
              id={`n-${pet.id}`}
              value={form.note}
              maxLength={200}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="備註資訊（選填）"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={addWeight.isPending || !form.weight}
            className="col-span-2 sm:col-span-1 px-4 py-2 text-xs font-mono font-bold border border-[#191919] bg-[#fffa00] text-[#191919] hover:bg-black hover:text-[#fffa00] transition-colors disabled:opacity-50"
          >
            {addWeight.isPending ? '登記中...' : '確認登記'}
          </button>
        </div>
        {addWeight.isError && (
          <p role="alert" className="mt-2 font-mono text-xs text-red-500">
            [ERROR] {errorText(addWeight.error)}
          </p>
        )}
        <p className="mt-2 font-mono text-[10px] text-[#8a8a8a]">
          // 更新體重後，飲食管理模組將即時同步重新估算建議每日熱量需求。
        </p>
      </form>

      {/* 歷史紀錄 */}
      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#f0f0f0]">
          <div className="text-[10px] font-mono font-bold tracking-wider text-[#8a8a8a] mb-2">
            // MEASUREMENT_HISTORY ({history.length})
          </div>
          <ul className="divide-y divide-[#f0f0f0]">
            {visibleHistory.map(r => (
              <li key={r.id} className="flex items-center gap-3 py-2 text-xs group">
                <span className="w-24 shrink-0 font-mono text-[#8a8a8a]">{r.measured_on}</span>
                <span className="font-mono font-bold text-[#191919]">{formatKg(r.weight)} KG</span>
                {r.diff !== null && r.diff !== 0 && (
                  <span
                    className={`font-mono font-semibold text-[11px] px-1 py-0.2 border ${
                      r.diff > 0
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-sky-300 bg-sky-50 text-sky-800'
                    }`}
                  >
                    {r.diff > 0 ? '+' : ''}{formatKg(r.diff)} kg
                  </span>
                )}
                {r.note && <span className="min-w-0 flex-1 truncate text-[#555]">{r.note}</span>}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`刪除 ${r.measured_on} 的體重紀錄？`)) removeWeight.mutate(r.id)
                  }}
                  disabled={removeWeight.isPending}
                  aria-label={`刪除 ${r.measured_on} 的體重紀錄`}
                  className="ml-auto shrink-0 text-xs font-mono text-[#8a8a8a] hover:text-red-600 transition-colors opacity-80 group-hover:opacity-100 flex items-center gap-1 disabled:opacity-30"
                >
                  <Trash2 size={12} />
                  <span>刪除</span>
                </button>
              </li>
            ))}
          </ul>
          {history.length > HISTORY_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="mt-2 text-xs font-mono font-semibold text-[#191919] hover:underline flex items-center gap-1"
            >
              {showAll ? '▲ 收合歷史紀錄' : `▼ 展開全部 ${history.length} 筆歷史紀錄`}
            </button>
          )}
          {removeWeight.isError && (
            <p role="alert" className="mt-1 font-mono text-xs text-red-500">
              [ERROR] 刪除失敗，請稍後再試
            </p>
          )}
        </div>
      )}
    </section>
  )
}