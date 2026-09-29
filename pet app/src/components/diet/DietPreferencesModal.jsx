import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

// ======================================================
// 飼主的飲食偏好
// 「今日飲食計畫」會依這裡的設定挑選食物與餐數，
// 「餵食前檢查」也會用「避免的食物」提醒。
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

function PrefsForm({ pet, initial, onClose }) {
  const qc = useQueryClient()

  const [mealsPerDay, setMealsPerDay] = useState(initial.mealsPerDay)
  const [stapleType, setStapleType] = useState(initial.stapleType)
  const [goal, setGoal] = useState(initial.goal)
  const [avoidFoods, setAvoidFoods] = useState(initial.avoidFoods)
  const [notes, setNotes] = useState(initial.notes)
  const [draft, setDraft] = useState('')

  const save = useMutation({
    mutationFn: () =>
      api
        .put(`/feeding/pet/${pet.id}/diet-preferences`, {
          mealsPerDay,
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
    `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
      active
        ? 'bg-green-50 border-green-300 text-green-700'
        : 'bg-white border-gray-200 text-gray-500 hover:border-green-200'
    }`

  return (
    <div className="p-6">

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-800">
            {pet.name} 的飲食偏好
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            飲食計畫會依這些設定挑選食物
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ✕
        </button>
      </div>

      <div className="space-y-5">

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">一天餵幾餐</p>
          <div className="flex gap-2">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setMealsPerDay(n)}
                className={chip(mealsPerDay === n)}
              >
                {n} 餐
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">主食偏好</p>
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
          <p className="text-xs font-semibold text-gray-600 mb-2">飲食目標</p>
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
          <p className="text-xs text-gray-400 mt-1.5">
            幼年寵物成長需求特殊，不會套用減重／增重調整。
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">
            要避免的食物（過敏、不吃、不想餵）
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
              placeholder="例如：雞肉、牛奶、零食"
              maxLength={30}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            />

            <button
              type="button"
              onClick={addAvoid}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600"
            >
              加入
            </button>
          </div>

          {avoidFoods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {avoidFoods.map(food => (
                <span
                  key={food}
                  className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-1 rounded-full"
                >
                  {food}
                  <button
                    type="button"
                    onClick={() =>
                      setAvoidFoods(avoidFoods.filter(f => f !== food))
                    }
                    className="hover:text-red-700"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-1.5">
            選到這些食物時，系統會提醒你確認。
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">其他備註</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="選填"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400 resize-none"
          />
        </div>

      </div>

      {save.isError && (
        <p className="text-xs text-red-500 mt-3">儲存失敗，請稍後再試。</p>
      )}

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600"
        >
          取消
        </button>

        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
        >
          {save.isPending ? '儲存中…' : '儲存偏好'}
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 max-h-[90vh] overflow-y-auto">

        {isLoading && (
          <p className="p-6 text-sm text-gray-400">讀取中…</p>
        )}

        {isError && (
          <div className="p-6">
            <p className="text-sm text-red-500">讀取偏好失敗。</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 text-sm text-gray-500 underline"
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