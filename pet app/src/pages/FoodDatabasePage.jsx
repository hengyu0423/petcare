import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

const CAT_LABEL = {
  dry: '乾糧',
  wet: '濕食',
  snack: '零食',
  supplement: '保健品',
  other: '其他'
}

const CAT_COLOR = {
  dry: 'bg-green-50 text-green-600',
  wet: 'bg-blue-50 text-blue-600',
  snack: 'bg-amber-50 text-amber-600',
  supplement: 'bg-purple-50 text-purple-600',
  other: 'bg-gray-50 text-gray-500'
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all'

export default function FoodDatabasePage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const [search, setSearch] = useState('')
  const [aiName, setAiName] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiImage, setAiImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [aiResult, setAiResult] = useState(null)

  // ✅ 修正 #4：追蹤 objectURL 以便釋放記憶體
  const prevImageUrlRef = useRef('')

  const [form, setForm] = useState({
    name: '',
    category: 'dry',
    brand: '',
    calories_per_100g: '',
    protein_pct: '',
    fat_pct: '',
    carb_pct: '',
    fiber_pct: ''
  })

  const { data: foods = [], isLoading } = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.get('/food').then((r) => r.data.data)
  })

  const addFood = useMutation({
    mutationFn: (payload) => api.post('/food', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foods'] })
      setShowModal(false)
      setForm({
        name: '',
        category: 'dry',
        brand: '',
        calories_per_100g: '',
        protein_pct: '',
        fat_pct: '',
        carb_pct: '',
        fiber_pct: ''
      })
    }
  })

  // ✅ 修正 #1：原本是 api.delete`/food/${id}`) — tagged template + 多餘右括號
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

  const filtered = foods.filter((f) => {
    const matchCat = filterCat === 'all' || f.category === filterCat
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.brand || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">食物資料庫</h1>
            <p className="text-sm text-gray-400 mt-0.5">管理常用食物的營養資訊</p>
          </div>
          <div className="flex gap-2">
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

                // ✅ 修正 #4：釋放前一張預覽的記憶體
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
              className="border border-green-300 text-green-600 hover:bg-green-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              📷 選擇圖片
            </button>
            <button
              onClick={handleImageAnalyze}
              disabled={!aiImage || aiLoading}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {aiLoading ? '分析中...' : '🤖 圖片分析'}
            </button>
            {foods.length === 0 && (
              <button
                onClick={() => initPresets.mutate()}
                disabled={initPresets.isPending}
                className="border border-green-300 text-green-600 hover:bg-green-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                📦 載入預設食物
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              ＋ 新增食物
            </button>
          </div>
        </div>

        {/* AI 文字分析 */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-700 mb-1">
              AI 快速分析食物營養
            </p>
            <div className="flex gap-2">
              <input
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                placeholder="輸入食物名稱，AI 自動填入營養數據..."
                className="flex-1 border border-green-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                onKeyDown={(e) => e.key === 'Enter' && handleAiAnalyze()}
              />
              <button
                onClick={handleAiAnalyze}
                disabled={aiLoading || !aiName.trim()}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {aiLoading ? '分析中...' : '分析'}
              </button>
            </div>
          </div>
        </div>

        {/* AI 圖片結果 */}
        {(imagePreview || aiResult) && (
          <div className="bg-white border border-green-200 rounded-xl p-4 mb-5">
            <div className="flex gap-4">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="食物預覽"
                  className="w-28 h-28 rounded-xl object-cover"
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-700 mb-2">
                  🤖 AI圖片分析結果
                </p>
                {aiResult && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p>
                      食物：
                      <b>{aiResult.image_food_name || aiResult.food_name || '未知食物'}</b>
                    </p>
                    <p>
                      熱量：<b>{aiResult.calories_per_100g} kcal</b>
                    </p>
                    <p>
                      蛋白質：<b>{aiResult.protein_pct}%</b>
                    </p>
                    <p>
                      脂肪：<b>{aiResult.fat_pct}%</b>
                    </p>
                    <p>
                      碳水：<b>{aiResult.carb_pct}%</b>
                    </p>
                    <p>
                      纖維：<b>{aiResult.fiber_pct}%</b>
                    </p>
                    {aiResult.notes && (
                      <p className="col-span-2 text-gray-600">{aiResult.notes}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              ＋ 加入食物庫
            </button>
          </div>
        )}

        {/* 搜尋 + 篩選 */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋食物名稱或品牌..."
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400 w-56"
          />
          <div className="flex gap-1.5">
            {[
              ['all', '全部'],
              ['dry', '乾糧'],
              ['wet', '濕食'],
              ['snack', '零食'],
              ['supplement', '保健品']
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterCat(val)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                  filterCat === val
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white border-gray-200 text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 食物列表 */}
        {isLoading ? (
          <p className="text-sm text-gray-300">載入中...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
            <p className="text-4xl mb-3">🗄️</p>
            <p className="text-gray-400 text-sm">沒有符合的食物</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((food) => (
              <div
                key={food.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all"
              >
                <div className="flex justify-between mb-2">
                  <div>
                    {/* ✅ 修正 #2：原本是 className=`...` 缺少 JSX 的 {} 包裹 */}
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        CAT_COLOR[food.category] || CAT_COLOR.other
                      }`}
                    >
                      {CAT_LABEL[food.category] || food.category}
                    </span>
                    <p className="text-sm font-semibold text-gray-800 mt-2">
                      {food.name}
                    </p>
                    {food.brand && (
                      <p className="text-xs text-gray-400">{food.brand}</p>
                    )}
                  </div>
                  {!food.is_preset && (
                    <button
                      onClick={() => deleteFood.mutate(food.id)}
                      className="text-gray-300 hover:text-red-400"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1 mt-3">
                  {[
                    ['熱量', food.calories_per_100g ? `${food.calories_per_100g}` : '—'],
                    ['蛋白質', food.protein_pct ? `${food.protein_pct}%` : '—'],
                    ['脂肪', food.fat_pct ? `${food.fat_pct}%` : '—'],
                    ['碳水', food.carb_pct ? `${food.carb_pct}%` : '—']
                  ].map(([label, val]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-xs font-bold text-gray-700">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-800">新增食物</h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                addFood.mutate(form)
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  食物名稱 *
                </label>
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
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    類別
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className={inputCls}
                  >
                    {Object.entries(CAT_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    品牌
                  </label>
                  <input
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                    placeholder="選填"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  熱量 (kcal/100g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.calories_per_100g}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, calories_per_100g: e.target.value }))
                  }
                  placeholder="例如：380"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['protein_pct', '蛋白質 (%)'],
                  ['fat_pct', '脂肪 (%)'],
                  ['carb_pct', '碳水 (%)']
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      {label}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-500 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={addFood.isPending}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {addFood.isPending ? '新增中...' : '新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}