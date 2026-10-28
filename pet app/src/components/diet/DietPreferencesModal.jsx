import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'

const STAPLE_OPTIONS = [
  { value: 'any',   label: '不限品類' },
  { value: 'dry',   label: '乾糧主食' },
  { value: 'wet',   label: '主食濕罐' },
  { value: 'mixed', label: '乾濕搭配' }
]

const GOAL_OPTIONS = [
  { value: 'maintain', label: '維持健康體重' },
  { value: 'lose',     label: '減重管理' },
  { value: 'gain',     label: '增重調理' }
]

function PrefsForm({ pet, initial, onClose }) {
  const qc = useQueryClient()

  const [mealsPerDay, setMealsPerDay] = useState(initial.mealsPerDay || 2)
  const [stapleType, setStapleType] = useState(initial.stapleType || 'any')
  const [goal, setGoal] = useState(initial.goal || 'maintain')
  const [avoidFoods, setAvoidFoods] = useState(initial.avoidFoods || [])
  const [notes, setNotes] = useState(initial.notes || '')
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

  const removeAvoid = index => {
    setAvoidFoods(avoidFoods.filter((_, i) => i !== index))
  }

  return (
    <div className="p-5 sm:p-6 bg-[var(--ef-panel)] text-[var(--ef-ink)] font-sans">
      {/* 頂部標題 */}
      <div className="flex items-center justify-between border-b border-[var(--ef-rule)] pb-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3.5 bg-[var(--ef-signal)] border border-[var(--ef-ink)]" />
          <span className="font-bold text-sm text-[var(--ef-ink)]">
            {pet.name} 的飲食偏好設定
          </span>
          <span className="text-[10px] font-mono text-[var(--ef-ink-2)]">// PREFERENCES</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center border border-[var(--ef-rule)] hover:border-[var(--ef-ink)] text-[var(--ef-ink-2)] hover:text-[var(--ef-ink)] transition-colors"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)' }}
          aria-label="關閉"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-4">
        {/* 一天餐數 */}
        <div>
          <label className="block text-[10px] font-mono text-[var(--ef-ink-2)] mb-1.5 uppercase tracking-wider">
            每日餵食頻率 / MEALS PER DAY
          </label>
          <div className="flex gap-2">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setMealsPerDay(n)}
                className={`flex-1 py-1.5 text-xs font-mono font-bold border transition-colors ${
                  mealsPerDay === n
                    ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] border-[var(--ef-ink)]'
                    : 'bg-[var(--ef-paper)] border-[var(--ef-rule)] text-[var(--ef-ink-2)] hover:border-[var(--ef-ink)]'
                }`}
                style={{
                  clipPath: mealsPerDay === n ? 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)' : 'none'
                }}
              >
                {n} 餐
              </button>
            ))}
          </div>
        </div>

        {/* 主食型態 */}
        <div>
          <label className="block text-[10px] font-mono text-[var(--ef-ink-2)] mb-1.5 uppercase tracking-wider">
            偏好主食種類 / STAPLE TYPE
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STAPLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStapleType(opt.value)}
                className={`py-1.5 px-2 text-xs font-mono border text-center transition-colors ${
                  stapleType === opt.value
                    ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] border-[var(--ef-ink)] font-bold'
                    : 'bg-[var(--ef-paper)] border-[var(--ef-rule)] text-[var(--ef-ink-2)] hover:border-[var(--ef-ink)]'
                }`}
                style={{
                  clipPath: stapleType === opt.value ? 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)' : 'none'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 體重管理目標 */}
        <div>
          <label className="block text-[10px] font-mono text-[var(--ef-ink-2)] mb-1.5 uppercase tracking-wider">
            健康管理目標 / MANAGEMENT GOAL
          </label>
          <div className="grid grid-cols-3 gap-2">
            {GOAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGoal(opt.value)}
                className={`py-1.5 px-2 text-xs font-mono border text-center transition-colors ${
                  goal === opt.value
                    ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] border-[var(--ef-ink)] font-bold'
                    : 'bg-[var(--ef-paper)] border-[var(--ef-rule)] text-[var(--ef-ink-2)] hover:border-[var(--ef-ink)]'
                }`}
                style={{
                  clipPath: goal === opt.value ? 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)' : 'none'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 避免或過敏食物 */}
        <div>
          <label className="block text-[10px] font-mono text-[var(--ef-ink-2)] mb-1.5 uppercase tracking-wider">
            需避開食物或成分 / AVOID ITEMS
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAvoid())}
              placeholder="輸入食物如：牛肉、玉米、乳製品..."
              className="flex-1 bg-[var(--ef-panel)] border border-[var(--ef-rule)] px-3 py-1.5 text-xs text-[var(--ef-ink)] font-mono focus:border-[var(--ef-ink)] focus:outline-hidden"
            />
            <button
              type="button"
              onClick={addAvoid}
              className="ef-btn small px-3 shrink-0"
            >
              加入
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {avoidFoods.map((item, index) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 text-[11px] font-mono bg-[var(--ef-paper)] text-[var(--ef-ink)] border border-[var(--ef-rule)] px-2 py-0.5"
              >
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => removeAvoid(index)}
                  className="text-[var(--ef-ink-2)] hover:text-[var(--ef-danger)]"
                  aria-label={`移除 ${item}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* 備註說明 */}
        <div>
          <label className="block text-[10px] font-mono text-[var(--ef-ink-2)] mb-1.5 uppercase tracking-wider">
            其他特殊飲食要求 / ADDITIONAL NOTES
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="例如：需少量多餐、喜歡溫水泡軟飼料..."
            className="w-full bg-[var(--ef-panel)] border border-[var(--ef-rule)] px-3 py-2 text-xs text-[var(--ef-ink)] font-mono focus:border-[var(--ef-ink)] focus:outline-hidden resize-none"
          />
        </div>
      </div>

      {save.isError && (
        <div className="mt-3 p-2 bg-[var(--ef-paper)] border border-[var(--ef-danger)] text-[var(--ef-danger)] text-xs font-mono flex items-center gap-1.5">
          <AlertCircle size={13} />
          <span>儲存偏好失敗，請稍後再試。</span>
        </div>
      )}

      <div className="flex gap-2 pt-4 mt-5 border-t border-[var(--ef-rule)]">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 ef-btn small"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="flex-1 ef-btn small go"
        >
          {save.isPending ? '儲存中...' : '儲存飲食偏好'}
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

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
      <div
        className="relative bg-[var(--ef-panel)] border-2 border-[var(--ef-ink)] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' }}
      >
        {isLoading && (
          <p className="p-8 text-center text-xs font-mono text-[var(--ef-ink-2)]">
            讀取設定中... // LOADING_PREFERENCES
          </p>
        )}

        {isError && (
          <div className="p-6 text-center">
            <p className="text-xs text-[var(--ef-danger)] font-mono">※ 讀取偏好失敗</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 ef-btn small"
            >
              關閉視窗
            </button>
          </div>
        )}

        {data && (
          <PrefsForm pet={pet} initial={data} onClose={onClose} />
        )}
      </div>
    </div>,
    document.body
  )
}