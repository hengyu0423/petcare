import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BracketTitle,
  CornerBrackets,
  Button,
  Tag
} from '@endfield-ui/react'
import {
  ArrowLeft,
  Camera,
  Sparkles,
  Plus,
  Trash2,
  Search,
  Box,
  Database,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { api } from '../lib/api'

const CAT_LABEL = {
  dry: '乾糧',
  wet: '濕食',
  snack: '零食',
  supplement: '保健品',
  other: '其他'
}

const inputCls =
  'w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-2 text-xs text-[#191919] font-mono focus:border-[#191919] focus:outline-hidden transition-colors'

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
    queryFn: () => api.get('/food').then(r => r.data.data)
  })

  const addFood = useMutation({
    mutationFn: payload => api.post('/food', payload),
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

  const deleteFood = useMutation({
    mutationFn: id => api.delete(`/food/${id}`),
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
        setForm(f => ({
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
    if (!aiImage || !(aiImage instanceof File)) return

    setAiLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', aiImage)

      const { data } = await api.post('/food/ai-analyze-image', formData)
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
        setForm(f => ({
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
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAiLoading(false)
    }
  }

  const filtered = foods.filter(f => {
    const matchCat = filterCat === 'all' || f.category === filterCat
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.brand || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6" data-theme="light">
      {/* 標題與導航 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/diet"
            className="w-9 h-9 flex items-center justify-center border border-[#d9d9d9] bg-white text-[#191919] hover:bg-[#191919] hover:text-[#fffa00] hover:border-[#191919] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <BracketTitle prefix="// NUTRITION.DATABASE">食物資料庫</BracketTitle>
            <p className="text-xs font-mono text-[#8a8a8a] mt-1 tracking-wider">
              維護各品牌寵物飼料、主食罐與副食品營養數據庫
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            id="food-image"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files[0]
              setAiImage(file)
              setAiResult(null)
              if (prevImageUrlRef.current) URL.revokeObjectURL(prevImageUrlRef.current)
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
            className="border border-[#d9d9d9] bg-white hover:border-[#191919] text-[#191919] px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Camera size={14} />
            <span>選擇包裝圖片</span>
          </button>
          <button
            onClick={handleImageAnalyze}
            disabled={!aiImage || aiLoading}
            className="border border-[#d9d9d9] bg-white hover:border-[#191919] text-[#191919] px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Sparkles size={14} />
            <span>{aiLoading ? '分析中...' : '辨識營養成分'}</span>
          </button>
          {foods.length === 0 && (
            <button
              onClick={() => initPresets.mutate()}
              disabled={initPresets.isPending}
              className="border border-[#d9d9d9] bg-white hover:border-[#191919] text-[#191919] px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Box size={14} />
              <span>載入預設品項</span>
            </button>
          )}
          <Button
            variant="action"
            onClick={() => setShowModal(true)}
            className="text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>新增品項</span>
          </Button>
        </div>
      </div>

      {/* AI 文字快速填入卡 */}
      <div className="relative bg-white border border-[#d9d9d9] p-4 shadow-xs">
        <CornerBrackets size="sm" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#191919]" />
            <span className="font-bold text-xs text-[#191919]">AI 快速填入營養參數：</span>
            <span className="text-[11px] font-mono text-[#8a8a8a]">輸入商品或飼料名稱自動估算</span>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              value={aiName}
              onChange={e => setAiName(e.target.value)}
              placeholder="例如：渴望六種魚全犬配方、巔峰肉乾..."
              className="flex-1 bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-1.5 text-xs text-[#191919] focus:border-[#191919] focus:outline-hidden"
              onKeyDown={e => e.key === 'Enter' && handleAiAnalyze()}
            />
            <Button
              variant="action"
              onClick={handleAiAnalyze}
              disabled={aiLoading || !aiName.trim()}
              className="text-xs py-1.5 px-3 shrink-0"
            >
              {aiLoading ? '查詢中...' : '解析'}
            </Button>
          </div>
        </div>
      </div>

      {/* AI 圖片分析預覽 */}
      {(imagePreview || aiResult) && (
        <div className="relative bg-white border border-[#191919] p-5 shadow-xs">
          <CornerBrackets size="sm" />
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {imagePreview && (
              <img
                src={imagePreview}
                alt="飼料圖片"
                className="w-32 h-32 object-cover border border-[#d9d9d9] bg-[#fafafa]"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Tag size="sm" variant="default" className="bg-[#191919] text-[#fffa00] border-[#191919] font-mono">
                  OCR_ANALYSIS
                </Tag>
                <span className="font-bold text-xs text-[#191919]">包裝成分辨識結果</span>
              </div>
              {aiResult && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="bg-[#f8f8f8] p-2 border border-[#e5e5e5]">
                    <span className="text-[10px] text-[#8a8a8a] block">品名</span>
                    <span className="font-bold text-[#191919] truncate block">
                      {aiResult.image_food_name || aiResult.food_name}
                    </span>
                  </div>
                  <div className="bg-[#f8f8f8] p-2 border border-[#e5e5e5]">
                    <span className="text-[10px] text-[#8a8a8a] block">熱量</span>
                    <span className="font-bold text-[#191919] block">{aiResult.calories_per_100g} kcal</span>
                  </div>
                  <div className="bg-[#f8f8f8] p-2 border border-[#e5e5e5]">
                    <span className="text-[10px] text-[#8a8a8a] block">粗蛋白</span>
                    <span className="font-bold text-[#191919] block">{aiResult.protein_pct}%</span>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <Button
                  variant="action"
                  onClick={() => setShowModal(true)}
                  className="text-xs py-1.5 px-3"
                >
                  ＋ 套用並編輯加入資料庫
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 搜尋與篩選列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-xs w-full">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋食物名稱、品牌..."
            className="w-full bg-white border border-[#d9d9d9] px-3 py-2 text-xs text-[#191919] focus:border-[#191919] focus:outline-hidden"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {[
            ['all', '全部分類'],
            ['dry', '乾糧'],
            ['wet', '濕食罐頭'],
            ['snack', '零食肉乾'],
            ['supplement', '保健機能']
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterCat(val)}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                filterCat === val
                  ? 'bg-[#191919] text-[#fffa00] font-bold'
                  : 'bg-white border border-[#d9d9d9] text-[#555] hover:border-[#191919]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 食物品項卡片清單 */}
      {isLoading ? (
        <div className="border border-[#d9d9d9] bg-white p-12 text-center text-xs font-mono text-[#8a8a8a]">
          讀取食物資料庫中... // LOADING_FOODS
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative border border-[#d9d9d9] bg-white p-16 text-center">
          <CornerBrackets size="sm" />
          <Database size={32} className="text-[#8a8a8a] mx-auto mb-2" />
          <p className="font-bold text-xs text-[#191919]">查無符合條件的食物品項</p>
          <p className="text-[11px] font-mono text-[#8a8a8a] mt-1">可點擊右上角新增品項或載入預設品項</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(food => (
            <div
              key={food.id}
              className="relative bg-white border border-[#d9d9d9] hover:border-[#191919] p-4 transition-colors flex flex-col justify-between group shadow-2xs"
            >
              <CornerBrackets size="sm" />

              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Tag size="sm" variant="default" className="text-[10px] font-mono">
                    {CAT_LABEL[food.category] || food.category}
                  </Tag>
                  {!food.is_preset && (
                    <button
                      onClick={() => {
                        if (window.confirm(`確定刪除「${food.name}」？`)) {
                          deleteFood.mutate(food.id)
                        }
                      }}
                      className="text-[#b0b0b0] hover:text-[#dc2626] transition-colors p-1"
                      title="刪除品項"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <p className="font-bold text-sm text-[#191919] leading-snug">{food.name}</p>
                {food.brand && (
                  <p className="text-[11px] font-mono text-[#8a8a8a] mt-0.5">{food.brand}</p>
                )}
              </div>

              {/* 四格宏量營養素 */}
              <div className="grid grid-cols-4 gap-1.5 mt-4 pt-3 border-t border-[#f0f0f0]">
                {[
                  ['熱量', food.calories_per_100g ? `${food.calories_per_100g}` : '—'],
                  ['蛋白質', food.protein_pct ? `${food.protein_pct}%` : '—'],
                  ['脂肪', food.fat_pct ? `${food.fat_pct}%` : '—'],
                  ['碳水', food.carb_pct ? `${food.carb_pct}%` : '—']
                ].map(([label, val]) => (
                  <div key={label} className="bg-[#fafafa] border border-[#f0f0f0] p-1.5 text-center">
                    <span className="text-[9px] font-mono text-[#8a8a8a] block">{label}</span>
                    <span className="text-xs font-mono font-bold text-[#191919] block truncate">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增食物 Modal */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" data-theme="light">
            <div className="relative bg-white border border-[#191919] shadow-2xl p-6 w-full max-w-md">
              <CornerBrackets size="md" />

              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-4 bg-[#fffa00]" />
                  <span className="font-bold text-base text-[#191919]">新增品項檔案</span>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-7 h-7 flex items-center justify-center border border-[#e5e5e5] text-[#8a8a8a] hover:text-[#191919] hover:border-[#191919]"
                >
                  <X size={14} />
                </button>
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault()
                  addFood.mutate(form)
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1 uppercase tracking-wider">
                    品項名稱 / FOOD_NAME *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="例如：皇家特定品種配方乾糧"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1 uppercase tracking-wider">
                      品類 / CATEGORY
                    </label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
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
                    <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1 uppercase tracking-wider">
                      品牌廠牌 / BRAND
                    </label>
                    <input
                      value={form.brand}
                      onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                      placeholder="選填"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1 uppercase tracking-wider">
                    每百克熱量 / KCAL PER 100G
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.calories_per_100g}
                    onChange={e => setForm(f => ({ ...f, calories_per_100g: e.target.value }))}
                    placeholder="380"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    ['protein_pct', '粗蛋白 (%)'],
                    ['fat_pct', '粗脂肪 (%)'],
                    ['carb_pct', '碳水 (%)']
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-[10px] font-mono text-[#8a8a8a] mb-1 uppercase tracking-wider">
                        {label}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder="0"
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-3 border-t border-[#e5e5e5]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2 text-xs border border-[#d9d9d9]"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="action"
                    disabled={addFood.isPending}
                    className="flex-1 py-2 text-xs"
                  >
                    {addFood.isPending ? '儲存中...' : '確認登錄'}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}