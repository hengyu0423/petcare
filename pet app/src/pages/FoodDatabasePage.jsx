import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Link } from 'react-router-dom'
import FoodIcon from '../components/brand/FoodIcon'
import PixelBullet from '../components/brand/PixelBullet'

const CAT_LABEL = {
  dry: '乾糧',
  wet: '濕食',
  snack: '零食',
  other: '其他'
}

const CAT_COLOR = {
  dry: 'bg-pine-50 text-pine-700',
  wet: 'bg-water-50 text-water-700',
  snack: 'bg-honey-100 text-honey-text',
  other: 'bg-cream text-ink-soft'
}

// 每個分類的圖示底色與熱量條顏色
const CAT_TONE = {
  dry: { tile: 'bg-pine-50', bar: 'bg-pine-700' },
  wet: { tile: 'bg-water-50', bar: 'bg-water-300' },
  snack: { tile: 'bg-honey-100', bar: 'bg-honey' },
  other: { tile: 'bg-cream', bar: 'bg-ink-faint' }
}
const KCAL_FULL_BAR = 500 // 熱量條以 500 kcal/100g 為滿格

// 450.00 → 450；85.5 → 85.5
const formatCal = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

const inputCls =
  'w-full border border-sand rounded-xl px-3 py-2.5 text-sm bg-cream text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-pine-700/35 focus:border-pine-700/40 focus:bg-plate transition-all'

const labelCls = 'mb-1.5 block text-xs font-semibold text-ink-soft'

const ICON = {
  back: <path d="M15 6l-6 6 6 6" />,
  camera: <><path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
  spark: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" /></>,
  box: <><path d="M4 8 12 4l8 4v8l-8 4-8-4Z" /><path d="M4 8l8 4 8-4M12 12v8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  pencil: <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M14.5 6.5l3 3" /></>,
  trash: <><path d="M4.5 7h15" /><path d="M9 7V5h6v2" /><path d="M6.5 7l.8 12h9.4l.8-12" /><path d="M10 10.5v5M14 10.5v5" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  archive: <><rect x="4" y="4.5" width="16" height="4" rx="1" /><path d="M5.5 8.5V19h13V8.5" /><path d="M10 12h4" /></>
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
      {ICON[name] || ICON.box}
    </svg>
  )
}

const outlineBtn =
  'inline-flex items-center gap-1.5 rounded-xl border border-hair-strong bg-plate px-3.5 py-2 text-sm font-bold text-pine-800 transition-colors hover:bg-warm disabled:opacity-50'
const solidBtn =
  'inline-flex items-center gap-1.5 rounded-xl bg-honey px-3.5 py-2 text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none disabled:opacity-50'

export default function FoodDatabasePage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingFood, setEditingFood] = useState(null) // null＝新增模式；有值＝編輯該食物
  const [filterCat, setFilterCat] = useState('all')
  const [search, setSearch] = useState('')
  const [aiName, setAiName] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiImage, setAiImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [aiResult, setAiResult] = useState(null)

  // 追蹤 objectURL 以便釋放記憶體
  const prevImageUrlRef = useRef('')

  const emptyForm = {
    name: '',
    category: 'dry',
    brand: '',
    calories_per_100g: '',
    protein_pct: '',
    fat_pct: '',
    carb_pct: '',
    fiber_pct: ''
  }

  const [form, setForm] = useState(emptyForm)

  const { data: foods = [], isLoading } = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.get('/food').then((r) => r.data.data)
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingFood(null)
    setForm(emptyForm)
  }

  const saveFood = useMutation({
    mutationFn: (payload) =>
      editingFood
        ? api.put(`/food/${editingFood.id}`, payload)
        : api.post('/food', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foods'] })
      closeModal()
    }
  })

  const openEdit = (food) => {
    setEditingFood(food)
    setForm({
      name: food.name || '',
      category: food.category || 'other',
      brand: food.brand || '',
      calories_per_100g: food.calories_per_100g ?? '',
      protein_pct: food.protein_pct ?? '',
      fat_pct: food.fat_pct ?? '',
      carb_pct: food.carb_pct ?? '',
      fiber_pct: food.fiber_pct ?? ''
    })
    setShowModal(true)
  }

  const deleteFood = useMutation({
    mutationFn: (id) => api.delete(`/food/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foods'] })
    }
  })

  const initPresets = useMutation({
    mutationFn: () => api.post('/food/init-presets'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foods'] })
    }
  })

  // AI 文字分析
  const handleAiAnalyze = async () => {
    if (!aiName.trim()) return
    setAiLoading(true)
    try {
      const { data } = await api.post('/food/ai-analyze', {
        foodName: aiName
      })
      if (data.success) {
        setEditingFood(null)
        setForm((f) => ({
          ...f,
          name: aiName,
          calories_per_100g: data.data.calories_per_100g || '',
          protein_pct: data.data.protein_pct || '',
          fat_pct: data.data.fat_pct || '',
          carb_pct: data.data.carb_pct || '',
          fiber_pct: data.data.fiber_pct || ''
        }))
        setShowModal(true)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAiLoading(false)
    }
  }

  // AI 圖片分析
  const handleImageAnalyze = async () => {
    if (!aiImage || !(aiImage instanceof File)) {
      console.warn('[FoodDatabasePage] no valid image selected', aiImage)
      return
    }

    console.log('[FoodDatabasePage] analyzing image', {
      name: aiImage.name,
      size: aiImage.size,
      type: aiImage.type,
      isFile: aiImage instanceof File
    })

    setAiLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', aiImage)

      const url = '/food/ai-analyze-image'
      console.log('[FoodDatabasePage] posting to', url)

      const { data } = await api.post(url, formData)
      console.log('[FoodDatabasePage] image analyze response', data)

      if (data.success) {
        const food = data.data
        const normalizedFood = {
          food_name: food.food_name || food.image_food_name || '',
          image_food_name: food.image_food_name || food.food_name || '',
          brand: food.brand || '',
          category: food.category || 'dry',
          calories_per_100g: food.calories_per_100g ?? '',
          protein_pct: food.protein_pct ?? '',
          fat_pct: food.fat_pct ?? '',
          carb_pct: food.carb_pct ?? '',
          fiber_pct: food.fiber_pct ?? '',
          notes: food.notes || ''
        }
        setAiResult(normalizedFood)
        setForm((f) => ({
          ...f,
          name: normalizedFood.image_food_name || normalizedFood.food_name || '',
          brand: normalizedFood.brand,
          category: normalizedFood.category || 'dry',
          calories_per_100g: normalizedFood.calories_per_100g ?? '',
          protein_pct: normalizedFood.protein_pct ?? '',
          fat_pct: normalizedFood.fat_pct ?? '',
          carb_pct: normalizedFood.carb_pct ?? '',
          fiber_pct: normalizedFood.fiber_pct ?? ''
        }))
      } else {
        console.error('[FoodDatabasePage] image analyze failed', data.error)
      }
    } catch (err) {
      console.error('[FoodDatabasePage] image analyze error', err?.response?.data || err)
    } finally {
      setAiLoading(false)
    }
  }

  const visibleFoods = foods.filter((f) => f.category !== 'supplement')
  const counts = {
    all: visibleFoods.length,
    dry: visibleFoods.filter((f) => f.category === 'dry').length,
    wet: visibleFoods.filter((f) => f.category === 'wet').length,
    snack: visibleFoods.filter((f) => f.category === 'snack').length
  }

  const filtered = foods.filter((f) => {
    if (f.category === 'supplement') return false // 不再保留保健品分類
    const matchCat = filterCat === 'all' || f.category === filterCat
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.brand || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <PageHeader
          back={{ to: '/diet', label: '返回飲食管理' }}
          title="食物"
          accent="資料庫"
          subtitle={
            <>
              管理常用食物的營養資訊
              {visibleFoods.length > 0 && <span className="ml-2 font-mono text-xs tabular-nums text-ink-mute">· {visibleFoods.length} 種</span>}
            </>
          }
          actions={
            <>
              <input
                id="food-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0]
                  console.log('[FoodDatabasePage] selected file', {
                    name: file?.name,
                    size: file?.size,
                    type: file?.type,
                    isFile: file instanceof File
                  })
                  setAiImage(file)
                  setAiResult(null)

                  if (prevImageUrlRef.current) {
                    URL.revokeObjectURL(prevImageUrlRef.current)
                  }
                  if (file) {
                    const url = URL.createObjectURL(file)
                    prevImageUrlRef.current = url
                    setImagePreview(url)
                  } else {
                    prevImageUrlRef.current = ''
                    setImagePreview('')
                  }
                }}
              />
              <button
                onClick={() => document.getElementById('food-image').click()}
                className={outlineBtn}
              >
                <LineIcon name="camera" size={15} />
                選擇圖片
              </button>
              <button
                onClick={handleImageAnalyze}
                disabled={!aiImage || aiLoading}
                className={solidBtn}
              >
                <LineIcon name="spark" size={15} />
                {aiLoading ? '分析中…' : '圖片分析'}
              </button>
              {foods.length === 0 && (
                <button
                  onClick={() => initPresets.mutate()}
                  disabled={initPresets.isPending}
                  className={outlineBtn}
                >
                  <LineIcon name="box" size={15} />
                  載入預設食物
                </button>
              )}
              <button
                onClick={() => {
                  setEditingFood(null)
                  setForm(emptyForm)
                  setShowModal(true)
                }}
                className={solidBtn}
              >
                <LineIcon name="plus" size={15} />
                新增食物
              </button>
            </>
          }
        />

        {/* AI 文字分析（深綠功能區） */}
        <div className="forest-band mb-5 rounded-3xl bg-pine-800 px-5 pb-8 pt-8 text-paper shadow-card md:px-6">
          <div className="relative flex flex-wrap items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <PixelBullet size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-brand text-[15px] font-extrabold text-paper">
                AI 快速估算食物<span className="text-lime">熱量</span>
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value)}
                  placeholder="輸入食物名稱，AI 自動估算熱量..."
                  className="w-full flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-paper placeholder:text-paper/50 focus:border-lime/60 focus:outline-none focus:ring-2 focus:ring-lime/40"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiAnalyze()}
                />
                <button
                  onClick={handleAiAnalyze}
                  disabled={aiLoading || !aiName.trim()}
                  className="btn-lime inline-flex shrink-0 items-center rounded-xl bg-lime px-4 py-2.5 font-brand text-sm font-extrabold text-pine-900 disabled:opacity-50"
                >
                  {aiLoading ? '分析中…' : '分析'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI 圖片結果 */}
        {(imagePreview || aiResult) && (
          <div className="mb-5 rounded-3xl border border-hair bg-plate p-4 shadow-card">
            <div className="flex flex-wrap gap-4">
              {imagePreview && (
                <img src={imagePreview} alt="食物預覽" className="h-28 w-28 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-sm font-bold text-pine-900">AI 圖片分析結果</p>
                {aiResult && (
                  <div className="grid grid-cols-2 gap-2 text-sm text-ink">
                    <p>食物：<b>{aiResult.image_food_name || aiResult.food_name || '未知食物'}</b></p>
                    <p>熱量：<b>{aiResult.calories_per_100g} kcal</b></p>
                    {aiResult.notes && <p className="col-span-2 text-ink-soft">{aiResult.notes}</p>}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setEditingFood(null)
                setForm(emptyForm)
                setShowModal(true)
              }}
              className={`${solidBtn} mt-3`}
            >
              <LineIcon name="plus" size={15} />
              加入食物庫
            </button>
          </div>
        )}

        {/* 搜尋 + 篩選 */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/70">
              <LineIcon name="search" size={15} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋食物名稱或品牌..."
              className={`${inputCls} w-56 pl-9`}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['all', '全部'],
              ['dry', '乾糧'],
              ['wet', '濕食'],
              ['snack', '零食']
            ].map(([val, label]) => {
              const active = filterCat === val
              return (
                <button
                  key={val}
                  onClick={() => setFilterCat(val)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                    active
                      ? 'border-pine-700 bg-pine-800 text-warm'
                      : 'border-sand bg-plate text-ink-soft hover:border-pine-700/40'
                  }`}
                >
                  {label}
                  <span className={`font-mono text-[10px] tabular-nums ${active ? 'text-lime' : 'text-ink-faint'}`}>
                    {counts[val]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 食物列表 */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[148px]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="dry" title="沒有符合的食物" desc="換個關鍵字或分類試試。" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((food) => {
              const tone = CAT_TONE[food.category] || CAT_TONE.other
              const kcal = Number(food.calories_per_100g)
              const pct = Number.isFinite(kcal) && kcal > 0 ? Math.min(100, Math.round((kcal / KCAL_FULL_BAR) * 100)) : 0
              return (
                <div
                  key={food.id}
                  className="card-lift flex flex-col rounded-3xl border border-hair bg-plate p-4 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.tile}`}>
                      <FoodIcon category={food.category} size={34} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${CAT_COLOR[food.category] || CAT_COLOR.other}`}>
                        {CAT_LABEL[food.category] || food.category}
                      </span>
                      <p className="mt-1 line-clamp-2 font-brand text-[15px] font-extrabold leading-snug text-pine-900">{food.name}</p>
                      {food.brand && <p className="truncate text-xs text-ink-soft">{food.brand}</p>}
                    </div>

                    {!food.is_preset && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          onClick={() => openEdit(food)}
                          className="rounded-lg p-1.5 text-ink-soft/60 transition-colors hover:bg-pine-50 hover:text-pine-700"
                          title="修改"
                          aria-label={`修改 ${food.name}`}
                        >
                          <LineIcon name="pencil" size={15} />
                        </button>
                        <button
                          onClick={() => deleteFood.mutate(food.id)}
                          className="rounded-lg p-1.5 text-ink-soft/60 transition-colors hover:bg-clay-50 hover:text-clay"
                          title="刪除"
                          aria-label={`刪除 ${food.name}`}
                        >
                          <LineIcon name="trash" size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 熱量：大數字 + 熱量條（500 kcal/100g 為滿格） */}
                  <div className="mt-4 border-t border-hair pt-3">
                    <div className="flex items-end justify-between gap-2">
                      <span className="kicker">熱量</span>
                      <p className="whitespace-nowrap text-right">
                        <span className="font-brand text-2xl font-extrabold tabular-nums leading-none text-pine-900">
                          {formatCal(food.calories_per_100g)}
                        </span>
                        <span className="ml-1 font-mono text-[10px] text-ink-mute">kcal/100g</span>
                      </p>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-hair"
                      title={`以 ${KCAL_FULL_BAR} kcal/100g 為滿格`}
                      role="presentation"
                    >
                      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 新增／編輯 Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-900/35 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-hair bg-plate p-6 shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-brand text-base font-extrabold text-pine-900">
                {editingFood ? '編輯食物' : '新增食物'}
              </h2>
              <button
                onClick={closeModal}
                aria-label="關閉"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-warm hover:text-pine-900"
              >
                <LineIcon name="close" size={16} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveFood.mutate(form)
              }}
              className="space-y-4"
            >
              <div>
                <label className={labelCls}>食物名稱</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例如：希爾思成貓乾糧"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>類別</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className={inputCls}
                  >
                    {Object.entries(CAT_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>品牌</label>
                  <input
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                    placeholder="選填"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>熱量 (kcal/100g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.calories_per_100g}
                  onChange={(e) => setForm((f) => ({ ...f, calories_per_100g: e.target.value }))}
                  placeholder="例如：380"
                  className={inputCls}
                />
              </div>
              {/* 一般只看熱量：蛋白質／脂肪／碳水不再輸入 */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-line bg-plate py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-warm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saveFood.isPending}
                  className="flex-1 rounded-xl bg-honey py-2.5 text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none disabled:opacity-50"
                >
                  {saveFood.isPending
                    ? editingFood ? '儲存中…' : '新增中…'
                    : editingFood ? '儲存' : '新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
