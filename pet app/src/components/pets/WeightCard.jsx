import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ResponsiveContainer
} from 'recharts'
import { api } from '../../lib/api'
import { ageInMonths, formatAge } from '../../lib/petAge'
import {
  buildChart, weightTrend, weightNote, formatKg, formatAgeAxis,
  todayString, lifeStage
} from '../../lib/petInsights'

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all'

const BAND_FILL = { young: '#e0f2fe', adult: '#f0fdf4', senior: '#fffbeb' }
const HISTORY_PREVIEW = 6

const errorText = err => err?.response?.data?.error || '儲存失敗，請稍後再試'

function WeightTooltip({ active, payload, birthDate }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const months = birthDate ? ageInMonths(birthDate, p.date) : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-gray-800">{formatKg(p.weight)} kg</p>
      <p className="text-gray-500">
        {p.date}
        {months !== null && ` ・ ${formatAge(months)}`}
      </p>
      {p.note && <p className="mt-0.5 text-gray-400">{p.note}</p>}
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

  // 體重一變，寵物資料（目前體重）、飲食計畫的熱量建議都會跟著變，所以整個重新整理
  const refresh = () => qc.invalidateQueries()

  const addWeight = useMutation({
    mutationFn: payload => api.post(`/pets/${pet.id}/weights`, payload),
    onSuccess: () => {
      // 日期也回到今天：補登過去的體重後，下一筆不會不小心記到舊日期
      setForm({ weight: '', date: todayString(), note: '' })
      refresh()
    }
  })

  const removeWeight = useMutation({
    mutationFn: recordId => api.delete(`/pets/${pet.id}/weights/${recordId}`),
    onSuccess: refresh
  })

  const stage = lifeStage(pet.species, birthDate ? ageInMonths(birthDate) : null)

  // 這個專案開了 React Compiler，會自動記住計算結果，所以不需要再手動 useMemo
  const dateChart = buildChart(records, { mode: 'date' })
  const ageChart = birthDate ? buildChart(records, { mode: 'age', birthDate }) : null
  const canUseAge = !!ageChart && ageChart.points.length > 0
  const effectiveMode = mode === 'age' && canUseAge ? 'age' : 'date'
  const chart = effectiveMode === 'age' ? ageChart : dateChart

  const trend = weightTrend(records)
  const note = weightNote(trend, stage)
  const latest = records[records.length - 1]

  // 新到舊，並算出和前一筆（較舊）的差
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
    <section className="bg-white rounded-2xl border border-gray-200 p-5" aria-label="體重與成長曲線">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-800">體重與成長曲線</h2>
          {latest ? (
            <p className="mt-1 text-xs text-gray-500">
              目前 <span className="font-semibold text-gray-800">{formatKg(latest.weight)} kg</span>
              {trend && (
                <>
                  {' ・ '}近 {trend.spanDays} 天{' '}
                  <span
                    className={
                      trend.delta > 0 ? 'text-amber-600' : trend.delta < 0 ? 'text-sky-600' : 'text-gray-500'
                    }
                  >
                    {trend.delta > 0 ? '+' : ''}
                    {formatKg(trend.delta)} kg（{trend.pct > 0 ? '+' : ''}
                    {trend.pct.toFixed(1)}%）
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">記錄第一筆體重，之後就能看到成長曲線</p>
          )}
        </div>

        {canUseAge && (
          <div className="inline-flex shrink-0 rounded-lg border border-gray-200 p-0.5 text-xs" role="group" aria-label="橫軸">
            {[['date', '依日期'], ['age', '依年齡']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={effectiveMode === key}
                onClick={() => setMode(key)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${effectiveMode === key ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {note && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${note.level === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-600'
            }`}
        >
          {note.text}
        </p>
      )}

      {isLoading ? (
        <div className="mt-4 h-[240px] animate-pulse rounded-xl bg-gray-50" />
      ) : records.length > 0 ? (
        <div className="mt-4">
          <div className="h-[240px] w-full" data-testid="weight-chart">
            <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 560, height: 240 }}>
              <LineChart data={chart.points} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                {effectiveMode === 'age' &&
                  chart.areas.map(a => (
                    <ReferenceArea
                      key={a.key}
                      x1={a.from}
                      x2={a.to}
                      fill={BAND_FILL[a.key]}
                      fillOpacity={1}
                      ifOverflow="hidden"
                      label={{ value: a.label, position: 'insideTopLeft', fontSize: 10, fill: '#94a3b8' }}
                    />
                  ))}
                <XAxis
                  dataKey="x"
                  type="number"
                  scale={effectiveMode === 'date' ? 'time' : 'linear'}
                  domain={chart.xDomain}
                  ticks={chart.ticks}
                  tickFormatter={xTick}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  domain={chart.yDomain}
                  tickFormatter={formatKg}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  unit=" kg"
                />
                <Tooltip content={<WeightTooltip birthDate={birthDate} />} />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#22c55e', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {effectiveMode === 'age' && (
            <p className="mt-1 text-[10px] text-gray-400">
              背景色是一般的生命階段參考（未滿 1 歲為幼年、7 歲起為高齡），與飲食計畫使用同一個標準。
            </p>
          )}
          {records.length === 1 && (
            <p className="mt-2 text-xs text-gray-400">再記錄一次體重，就能連成曲線囉。</p>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          <p className="text-3xl mb-2">📈</p>
          還沒有體重紀錄
        </div>
      )}

      {/* 新增體重 */}
      <form onSubmit={submit} className="mt-4 rounded-xl bg-gray-50 p-3">
        <p className="mb-2 text-xs font-semibold text-gray-500">記錄體重</p>
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
              placeholder="體重 (kg)"
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
              placeholder="備註（選填）"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={addWeight.isPending || !form.weight}
            className="col-span-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-600 disabled:opacity-50 sm:col-span-1"
          >
            {addWeight.isPending ? '儲存中…' : '記錄'}
          </button>
        </div>
        {addWeight.isError && (
          <p role="alert" className="mt-2 text-xs text-red-500">{errorText(addWeight.error)}</p>
        )}
        <p className="mt-2 text-[11px] text-gray-400">
          更新體重後，飲食管理的每日熱量建議也會跟著調整。同一天再記錄一次會取代原本那一筆。
        </p>
      </form>

      {/* 歷史紀錄 */}
      {history.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold text-gray-500">歷史紀錄</p>
          <ul className="divide-y divide-gray-100">
            {visibleHistory.map(r => (
              <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-gray-400">{r.measured_on}</span>
                <span className="font-semibold text-gray-700">{formatKg(r.weight)} kg</span>
                {r.diff !== null && r.diff !== 0 && (
                  <span className={`text-xs ${r.diff > 0 ? 'text-amber-600' : 'text-sky-600'}`}>
                    {r.diff > 0 ? '+' : ''}{formatKg(r.diff)}
                  </span>
                )}
                {r.note && <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{r.note}</span>}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`刪除 ${r.measured_on} 的體重紀錄？`)) removeWeight.mutate(r.id)
                  }}
                  disabled={removeWeight.isPending}
                  aria-label={`刪除 ${r.measured_on} 的體重紀錄`}
                  className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  刪除
                </button>
              </li>
            ))}
          </ul>
          {history.length > HISTORY_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="mt-1 text-xs font-medium text-green-600 hover:underline"
            >
              {showAll ? '收合' : `顯示全部 ${history.length} 筆`}
            </button>
          )}
          {removeWeight.isError && (
            <p role="alert" className="mt-1 text-xs text-red-500">刪除失敗，請稍後再試</p>
          )}
        </div>
      )}
    </section>
  )
}