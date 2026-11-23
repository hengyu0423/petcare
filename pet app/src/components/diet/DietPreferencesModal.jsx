import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

// ======================================================
// 飼主的飲食偏好
//
// 一般飼主只需要選「一天幾餐」並存檔；
// 餐次時間、固定食物、主食偏好等進階設定
// 收在「進階設定」裡，避免一開始看到太多選項。
// ======================================================

const STAPLE_OPTIONS = [
  { value: 'any', label: '不限' },
  { value: 'dry', label: '乾糧' },
  { value: 'wet', label: '濕食' },
  { value: 'mixed', label: '乾濕搭配' }
]

const GOAL_OPTIONS = [
  { value: 'maintain', label: '維持體重' },
  { value: 'lose', label: '減重' },
  { value: 'gain', label: '增重' }
]

// 與後端 MEAL_SLOTS 一致的預設餐次
const DEFAULT_SCHEDULES = {
  2: [
    { key: 'breakfast', label: '早餐', time: '08:00' },
    { key: 'dinner', label: '晚餐', time: '18:30' }
  ],
  3: [
    { key: 'breakfast', label: '早餐', time: '08:00' },
    { key: 'lunch', label: '午餐', time: '12:30' },
    { key: 'dinner', label: '晚餐', time: '18:30' }
  ],
  4: [
    { key: 'breakfast', label: '早餐', time: '08:00' },
    { key: 'lunch', label: '午餐', time: '12:30' },
    { key: 'dinner', label: '晚餐', time: '18:30' },
    { key: 'late', label: '宵夜', time: '21:30' }
  ]
}

const MAX_MEALS = 6

function defaultSchedule(count) {
  const base = DEFAULT_SCHEDULES[count] || DEFAULT_SCHEDULES[3]
  return base.map(slot => ({ ...slot, foodId: '', amountG: '' }))
}

function normalizeSchedule(raw, mealsPerDay) {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((slot, index) => ({
      key: slot.key || `meal-${index + 1}`,
      label: slot.label || `第 ${index + 1} 餐`,
      time: slot.time || (index === 0 ? '08:00' : '18:30'),
      foodId: slot.foodId ? String(slot.foodId) : '',
      amountG: slot.amountG ? String(slot.amountG) : ''
    }))
  }

  return defaultSchedule(mealsPerDay)
}

function PrefsForm({ pet, initial, onClose }) {
  const qc = useQueryClient()

  const initialSchedule = normalizeSchedule(
    initial.mealSchedule,
    initial.mealsPerDay
  )

  // 是否和預設餐次完全一致（決定預設只看餐數或展開進階設定）
  const defaults = DEFAULT_SCHEDULES[initialSchedule.length] || []
  const isDefaultSchedule =
    initialSchedule.length === defaults.length &&
    initialSchedule.every(
      (slot, index) =>
        slot.label === defaults[index].label &&
        slot.time === defaults[index].time &&
        !slot.foodId &&
        !slot.amountG
    )

  const initialHasAdvanced =
    !isDefaultSchedule ||
    initial.stapleType !== 'any' ||
    initial.goal !== 'maintain' ||
    (initial.avoidFoods?.length || 0) > 0 ||
    Boolean(initial.notes)

  const [mealsPerDay, setMealsPerDay] = useState(
    initialSchedule.length || initial.mealsPerDay || 3
  )
  const [isCustom, setIsCustom] = useState(
    Array.isArray(initial.mealSchedule) &&
      initial.mealSchedule.length > 0 &&
      !isDefaultSchedule
  )
  const [schedule, setSchedule] = useState(initialSchedule)
  const [showAdvanced, setShowAdvanced] = useState(Boolean(initialHasAdvanced))
  const [stapleType, setStapleType] = useState(initial.stapleType)
  const [goal, setGoal] = useState(initial.goal)
  const [avoidFoods, setAvoidFoods] = useState(initial.avoidFoods)
  const [notes, setNotes] = useState(initial.notes)
  const [draft, setDraft] = useState('')

  // 固定食物選單
  const { data: foods = [] } = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.get('/food').then(r => r.data.data)
  })

  const foodOptions = useMemo(
    () =>
      [...foods]
        .filter(food => food?.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [foods]
  )

  const save = useMutation({
    mutationFn: () =>
      api
        .put(`/feeding/pet/${pet.id}/diet-preferences`, {
          mealsPerDay,
          mealSchedule: schedule.map(slot => ({
            key: slot.key,
            label: slot.label.trim() || '用餐',
            time: slot.time || '08:00',
            foodId: slot.foodId ? Number(slot.foodId) : null,
            amountG: slot.amountG ? Number(slot.amountG) : null
          })),
          stapleType,
          goal,
          avoidFoods,
          notes
        })
        .then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diet-preferences', pet.id] })
      qc.invalidateQueries({ queryKey: ['meal-plan', pet.id] })
      onClose()
    }
  })

  const addAvoid = () => {
    const text = draft.trim()
    if (!text || avoidFoods.includes(text) || avoidFoods.length >= 10) return
    setAvoidFoods([...avoidFoods, text])
    setDraft('')
  }

  const chip = active =>
    `px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
      active
        ? 'bg-pine-50 border-pine-700/35 text-pine-700'
        : 'bg-plate border-sand text-ink-soft hover:border-green-200'
    }`

  const presetKey = isCustom ? 'custom' : String(mealsPerDay)

  // 選擇 2／3／4 餐：換成對應預設時間，並保留同名餐次已選的固定食物
  const choosePreset = count => {
    const previous = new Map(schedule.map(slot => [slot.key, slot]))

    const next = DEFAULT_SCHEDULES[count].map(slot => ({
      ...slot,
      foodId: previous.get(slot.key)?.foodId || '',
      amountG: previous.get(slot.key)?.amountG || ''
    }))

    setMealsPerDay(count)
    setIsCustom(false)
    setSchedule(next)
  }

  const chooseCustom = () => {
    setIsCustom(true)
    setMealsPerDay(schedule.length)
    setShowAdvanced(true)
  }

  const updateSlot = (index, patch) => {
    setSchedule(prev =>
      prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot))
    )
  }

  const addSlot = () => {
    if (schedule.length >= MAX_MEALS) return

    setSchedule(prev => [
      ...prev,
      {
        key: `meal-${Date.now()}`,
        label: `第 ${prev.length + 1} 餐`,
        time: '12:00',
        foodId: '',
        amountG: ''
      }
    ])
    setIsCustom(true)
  }

  const removeSlot = index => {
    if (schedule.length <= 2) return

    setSchedule(prev => prev.filter((_, i) => i !== index))
    setIsCustom(true)
  }

  const scheduleInvalid =
    schedule.length < 2 ||
    schedule.some(slot => !slot.label.trim() || !slot.time)

  const scheduleSummary = schedule
    .map(slot => `${slot.label} ${slot.time}`)
    .join('・')

  const fixedFoodCount = schedule.filter(slot => slot.foodId).length

  return (
    <div className="p-6">

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-pine-900">
            {pet.name} 的飲食計畫
          </h2>
          <p className="text-xs text-ink-soft/80 mt-1">
            選好一天的餐數，系統就會安排今天的餵食
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/80 transition-colors hover:bg-warm hover:text-pine-900"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* 最簡模式：只選餐數 */}
      <div>
        <p className="text-xs font-semibold text-ink-soft mb-2">一天餵幾餐</p>

        <div className="flex flex-wrap gap-2">
          {[2, 3, 4].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => choosePreset(n)}
              className={`${chip(presetKey === String(n))} text-base px-4 py-2`}
            >
              {n} 餐
            </button>
          ))}

          <button
            type="button"
            onClick={chooseCustom}
            className={chip(presetKey === 'custom')}
          >
            自訂
          </button>
        </div>

        <p className="text-xs text-ink-soft mt-2.5 leading-relaxed">
          {scheduleSummary}
          {fixedFoodCount > 0 ? `・${fixedFoodCount} 餐有固定食物` : ''}
        </p>
      </div>

      {/* 進階設定 */}
      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        className="mt-4 w-full flex items-center justify-center gap-1 border border-sand rounded-xl py-2 text-xs font-semibold text-ink-soft hover:border-pine-700/30 hover:text-pine-700 transition-colors"
      >
        {showAdvanced
          ? '收合進階設定 ▲'
          : '進階設定（餐次時間、固定食物、主食偏好…）▼'}
      </button>

      {showAdvanced && (
        <div className="space-y-5 mt-4 pt-4 border-t border-hair">

          {/* 餐次時間與固定食物 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-soft">
                餐次時間與固定食物
              </p>
              <span className="text-[11px] text-ink-soft/80">
                {schedule.length} 餐
              </span>
            </div>

            <div className="space-y-2">
              {schedule.map((slot, index) => (
                <div
                  key={slot.key}
                  className="bg-cream rounded-xl p-2.5 space-y-2"
                >
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <input
                      value={slot.label}
                      onChange={e => {
                        updateSlot(index, { label: e.target.value })
                        setIsCustom(true)
                      }}
                      placeholder={`第 ${index + 1} 餐`}
                      maxLength={20}
                      className="border border-sand bg-plate rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-pine-700/40"
                    />

                    <input
                      type="time"
                      value={slot.time}
                      onChange={e => {
                        updateSlot(index, { time: e.target.value })
                        setIsCustom(true)
                      }}
                      className="border border-sand bg-plate rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-pine-700/40"
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_88px] gap-2">
                    <select
                      value={slot.foodId}
                      onChange={e =>
                        updateSlot(index, { foodId: e.target.value })
                      }
                      className="border border-sand bg-plate rounded-xl px-2.5 py-1.5 text-sm text-ink-soft focus:outline-none focus:border-pine-700/40"
                    >
                      <option value="">不固定（系統推薦）</option>
                      {foodOptions.map(food => (
                        <option key={food.id} value={String(food.id)}>
                          {food.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={slot.amountG}
                      disabled={!slot.foodId}
                      onChange={e =>
                        updateSlot(index, { amountG: e.target.value })
                      }
                      placeholder={slot.foodId ? '克數' : '—'}
                      className="border border-sand bg-plate rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-pine-700/40 disabled:bg-cream disabled:text-ink-soft/80"
                    />
                  </div>

                  {schedule.length > 2 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeSlot(index)}
                        className="text-[11px] text-clay hover:underline"
                      >
                        移除這一餐
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {schedule.length < MAX_MEALS && (
              <button
                type="button"
                onClick={addSlot}
                className="mt-2 w-full border border-dashed border-hair-strong rounded-xl py-2 text-xs font-semibold text-ink-soft hover:border-pine-700/30 hover:text-pine-700 transition-colors"
              >
                ＋ 增加一餐
              </button>
            )}

            {scheduleInvalid && (
              <p className="text-[11px] text-clay mt-2">
                每一餐都需要名稱與時間，且至少要有 2 餐。
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">主食偏好</p>
            <div className="flex flex-wrap gap-2">
              {STAPLE_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setStapleType(o.value)}
                  className={chip(stapleType === o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">飲食目標</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setGoal(o.value)}
                  className={chip(goal === o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-soft/80 mt-1.5">
              幼年寵物不套用減重／增重調整。
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">
              要避免的食物
            </p>

            <div className="flex gap-2">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addAvoid()
                  }
                }}
                placeholder="例如：雞肉、牛奶"
                maxLength={30}
                className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pine-700/40"
              />

              <button
                type="button"
                onClick={addAvoid}
                className="px-3 py-2 rounded-xl text-sm font-semibold bg-cream hover:bg-paper text-ink-soft"
              >
                加入
              </button>
            </div>

            {avoidFoods.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {avoidFoods.map(food => (
                  <span
                    key={food}
                    className="inline-flex items-center gap-1 text-xs bg-red-50 text-clay border border-red-100 px-2 py-1 rounded-full"
                  >
                    {food}
                    <button
                      type="button"
                      onClick={() =>
                        setAvoidFoods(avoidFoods.filter(f => f !== food))
                      }
                      aria-label={`移除 ${food}`}
                      className="hover:text-clay-700"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">其他備註</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="選填"
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pine-700/40 resize-none"
            />
          </div>

        </div>
      )}

      {save.isError && (
        <p className="text-xs text-clay mt-3">儲存失敗，請稍後再試。</p>
      )}

      <div className="flex gap-3 mt-5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-cream hover:bg-paper text-ink-soft"
        >
          取消
        </button>

        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || scheduleInvalid}
          className="flex-[2] py-2.5 rounded-xl text-sm font-semibold bg-honey hover:bg-honey-hover text-pine-900 shadow-press disabled:opacity-50"
        >
          {save.isPending ? '儲存中…' : '儲存'}
        </button>
      </div>

    </div>
  )
}

export default function DietPreferencesModal({ pet, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['diet-preferences', pet.id],
    queryFn: () =>
      api
        .get(`/feeding/pet/${pet.id}/diet-preferences`)
        .then(r => r.data.data)
  })

  return (
    <div className="fixed inset-0 bg-pine-900/35 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-plate rounded-3xl shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)] w-full max-w-md border border-hair max-h-[90vh] overflow-y-auto">

        {isLoading && (
          <p className="p-6 text-sm text-ink-soft/80">讀取中…</p>
        )}

        {isError && (
          <div className="p-6">
            <p className="text-sm text-clay">讀取偏好失敗。</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 text-sm text-ink-soft underline"
            >
              關閉
            </button>
          </div>
        )}

        {data && (
          <PrefsForm pet={pet} initial={data} onClose={onClose} />
        )}

      </div>
    </div>
  )
}
