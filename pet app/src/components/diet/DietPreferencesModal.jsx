import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CornerBrackets,
  Button,
  Tag
} from '@endfield-ui/react'
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
    <div className="p-6">
      {/* 頂部標題 */}
      <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 bg-[#fffa00]" />
          <span className="font-bold text-sm text-[#191919]">
            {pet.name} 的飲食偏好設定
          </span>
          <span className="text-[10px] font-mono text-[#8a8a8a]">// PREFERENCES</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center border border-[#e5e5e5] text-[#8a8a8a] hover:text-[#191919] hover:border-[#191919] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-4">
        {/* 一天餐數 */}
        <div>
          <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
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
                    ? 'bg-[#191919] text-[#fffa00] border-[#191919]'
                    : 'bg-[#fafafa] border-[#d9d9d9] text-[#555] hover:border-[#191919]'
                }`}
              >
                {n} 餐
              </button>
            ))}
          </div>
        </div>

        {/* 主食型態 */}
        <div>
          <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
            偏好主食種類 / STAPLE TYPE
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STAPLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStapleType(opt.value)}
                className={`py-1.5 px-2 text-xs font-mono font-medium border text-center transition-colors ${
                  stapleType === opt.value
                    ? 'bg-[#191919] text-[#fffa00] border-[#191919]'
                    : 'bg-[#fafafa] border-[#d9d9d9] text-[#555] hover:border-[#191919]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 體重管理目標 */}
        <div>
          <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
            健康管理目標 / MANAGEMENT GOAL
          </label>
          <div className="grid grid-cols-3 gap-2">
            {GOAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGoal(opt.value)}
                className={`py-1.5 px-2 text-xs font-mono font-medium border text-center transition-colors ${
                  goal === opt.value
                    ? 'bg-[#191919] text-[#fffa00] border-[#191919]'
                    : 'bg-[#fafafa] border-[#d9d9d9] text-[#555] hover:border-[#191919]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 避免或過敏食物 */}
        <div>
          <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
            需避開食物或成分 / AVOID ITEMS
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAvoid())}
              placeholder="輸入食物如：牛肉、玉米、乳製品..."
              className="flex-1 bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-1.5 text-xs text-[#191919] focus:border-[#191919] focus:outline-hidden"
            />
            <Button
              type="button"
              variant="action"
              onClick={addAvoid}
              className="text-xs py-1.5 px-3 shrink-0"
            >
              加入
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {avoidFoods.map((item, index) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 text-[11px] font-mono bg-[#f5f5f5] text-[#191919] border border-[#d9d9d9] px-2 py-0.5"
              >
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => removeAvoid(index)}
                  className="text-[#8a8a8a] hover:text-[#dc2626]"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* 備註說明 */}
        <div>
          <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
            其他特殊飲食要求 / ADDITIONAL NOTES
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="例如：需少量多餐、喜歡溫水泡軟飼料..."
            className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-2 text-xs text-[#191919] focus:border-[#191919] focus:outline-hidden resize-none"
          />
        </div>
      </div>

      {save.isError && (
        <div className="mt-3 p-2 bg-[#fff5f5] border border-[#ef4444] text-[#ef4444] text-xs font-mono flex items-center gap-1.5">
          <AlertCircle size={13} />
          <span>儲存偏好失敗，請稍後再試。</span>
        </div>
      )}

      <div className="flex gap-2 pt-4 mt-5 border-t border-[#e5e5e5]">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="flex-1 py-2 text-xs border border-[#d9d9d9]"
        >
          取消
        </Button>
        <Button
          type="button"
          variant="action"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="flex-1 py-2 text-xs"
        >
          {save.isPending ? '儲存中...' : '儲存飲食偏好'}
        </Button>
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
    <div className="fixed inset-0 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" data-theme="light">
      <div className="relative bg-white border border-[#191919] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CornerBrackets size="md" />

        {isLoading && (
          <p className="p-8 text-center text-xs font-mono text-[#8a8a8a]">
            讀取設定中... // LOADING_PREFERENCES
          </p>
        )}

        {isError && (
          <div className="p-6 text-center">
            <p className="text-xs text-[#ef4444] font-mono">讀取偏好失敗</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 text-xs text-[#191919] underline font-mono"
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