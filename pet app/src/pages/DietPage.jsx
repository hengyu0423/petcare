import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const EMOJI = {
  dog: '🐶',
  cat: '🐱',
  bird: '🐦',
  rabbit: '🐰',
  fish: '🐟',
  other: '🐾'
}

function calcNutrition(food, amountG) {
  if (!food || !amountG) return {}

  const ratio = amountG / 100

  return {
    calories: food.calories_per_100g
      ? +(food.calories_per_100g * ratio).toFixed(1)
      : null,
    proteinG: food.protein_pct
      ? +(food.protein_pct * ratio).toFixed(1)
      : null,
    fatG: food.fat_pct
      ? +(food.fat_pct * ratio).toFixed(1)
      : null,
    carbG: food.carb_pct
      ? +(food.carb_pct * ratio).toFixed(1)
      : null
  }
}

function getRecommendedCalories(pet) {
  if (!pet?.weight) return null

  const w = Number(pet.weight)
  const rer = 70 * Math.pow(w, 0.75)

  return Math.round(rer * 1.4)
}

export default function DietPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef(null)

  const getLocalDate = () => {
    const d = new Date()

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const getLocalDateTime = () => {
    const d = new Date()
    const offset = d.getTimezoneOffset()

    return new Date(
      d.getTime() - offset * 60000
    ).toISOString().slice(0, 16)
  }

  const today = getLocalDate()

  const [selectedPet, setSelectedPet] = useState(null)
  const [selectedDate, setSelectedDate] = useState(today)

  const [showAddModal, setShowAddModal] = useState(false)

  const [form, setForm] = useState({
    foodItemId: '',
    foodName: '',
    amountG: '',
    fedAt: getLocalDateTime(),
    notes: ''
  })

  const [selectedFood, setSelectedFood] = useState(null)

  // 新增：圖片辨識相關狀態
  const [inputMode, setInputMode] = useState('manual')
  const [foodImage, setFoodImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiError, setAiError] = useState('')

  const [dietAdvice, setDietAdvice] = useState('')
  const [loadingAdvice, setLoadingAdvice] = useState(false)
  const [adviceError, setAdviceError] = useState('')

  // 智慧餵食推薦 / 飲食警訊
  const [smartDiet, setSmartDiet] = useState(null)
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartError, setSmartError] = useState('')
  const [foodWarnings, setFoodWarnings] = useState([])
  const [checkingFood, setCheckingFood] = useState(false)
  const [warningAccepted, setWarningAccepted] = useState(false)
  const [checkedFoodKey, setCheckedFoodKey] = useState('')

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  useEffect(() => {
    if (pets.length > 0 && !selectedPet) {
      setSelectedPet(pets[0])
    }
  }, [pets])

  const { data: foods = [] } = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.get('/food').then(r => r.data.data)
  })

  const { data: records = [] } = useQuery({
    queryKey: ['feeding', selectedPet?.id, selectedDate],
    queryFn: () =>
      api
        .get(`/feeding/pet/${selectedPet.id}?date=${selectedDate}`)
        .then(r => r.data.data),
    enabled: !!selectedPet
  })

  const { data: dailyStats = [] } = useQuery({
    queryKey: ['feeding-stats', selectedPet?.id],
    queryFn: () =>
      api
        .get(`/feeding/pet/${selectedPet.id}/daily-stats`)
        .then(r => r.data.data),
    enabled: !!selectedPet
  })

  const { data: consultations = [] } = useQuery({
    queryKey: ['consultations', selectedPet?.id],
    queryFn: () =>
      api
        .get(`/consultations/pet/${selectedPet.id}`)
        .then(r => r.data.data),
    enabled: !!selectedPet
  })

  const buildPetPayload = () => ({
    name: selectedPet?.name || '',
    species: selectedPet?.species || '',
    breed: selectedPet?.breed || '',
    weight: selectedPet?.weight || null,
    birth_date: selectedPet?.birth_date || null
  })

  const buildHealthSummary = () => {
    const recentConsults = consultations
      .slice(-10)
      .map(
        m =>
          `${m.role === 'user' ? '飼主' : 'AI'}：${m.content}`
      )
      .join('\n')

    return recentConsults || '目前沒有健康諮詢紀錄'
  }

  const normalizeStatDate = value => {
    if (!value) return ''

    const text = String(value)

    if (text.includes('T') && text.endsWith('Z')) {
      const d = new Date(text)

      return (
        `${d.getFullYear()}-` +
        `${String(d.getMonth() + 1).padStart(2, '0')}-` +
        `${String(d.getDate()).padStart(2, '0')}`
      )
    }

    return text.slice(0, 10)
  }

  // 抓最近 7 天餵食紀錄，最多送 10 筆給後端分析
  const loadRecentMeals = async () => {
    if (!selectedPet) return []

    const datesFromStats = dailyStats
      .slice(0, 7)
      .map(stat => normalizeStatDate(stat.date))
      .filter(Boolean)

    const dates = [
      ...new Set([today, ...datesFromStats])
    ].slice(0, 7)

    const responses = await Promise.all(
      dates.map(date =>
        api
          .get(`/feeding/pet/${selectedPet.id}?date=${date}`)
          .then(r => r.data.data || [])
          .catch(() => [])
      )
    )

    return responses
      .flat()
      .sort(
        (a, b) =>
          new Date(b.fed_at || b.created_at || 0) -
          new Date(a.fed_at || a.created_at || 0)
      )
      .slice(0, 10)
      .map(record => {
        const dbFood = foods.find(food =>
          (record.food_item_id &&
            String(food.id) === String(record.food_item_id)) ||
          food.name === record.food_name
        )

        const meal = {
          food_name: record.food_name,
          amount_g: Number(record.amount_g || 0),
          fed_at: record.fed_at || record.created_at || null
        }

        if (dbFood) {
          meal.calories_per_100g = dbFood.calories_per_100g
          meal.protein_pct = dbFood.protein_pct
          meal.fat_pct = dbFood.fat_pct
          meal.carb_pct = dbFood.carb_pct
          meal.fiber_pct = dbFood.fiber_pct
        }

        return meal
      })
  }

  const loadSmartRecommendation = async () => {
    if (!selectedPet) return

    setSmartLoading(true)
    setSmartError('')

    try {
      const recentMeals = await loadRecentMeals()

      const { data } = await api.post('/food/smart-diet', {
        pet: buildPetPayload(),
        healthSummary: buildHealthSummary(),
        recentMeals
      })

      if (!data.success) {
        throw new Error(data.error || '無法取得飲食推薦')
      }

      setSmartDiet(data.data)
    } catch (err) {
      console.error('智慧飲食推薦失敗：', err)

      setSmartError(
        err.response?.data?.error ||
          err.message ||
          '無法取得飲食推薦'
      )
    } finally {
      setSmartLoading(false)
    }
  }

  const openAddModal = () => {
    resetAddForm()
    setShowAddModal(true)

    // Modal 開啟後立即依照過去飲食取得推薦
    loadSmartRecommendation()
  }

  const checkFoodSafety = async food => {
    if (!selectedPet || !food) return null

    setCheckingFood(true)
    setSmartError('')

    try {
      const recentMeals =
        smartDiet?.recentMeals?.length > 0
          ? smartDiet.recentMeals
          : await loadRecentMeals()

      const { data } = await api.post('/food/check-food', {
        pet: buildPetPayload(),
        healthSummary: buildHealthSummary(),
        recentMeals,
        food
      })

      if (!data.success) {
        throw new Error(data.error || '食物檢查失敗')
      }

      const warnings = data.data?.warnings || []

      setFoodWarnings(warnings)
      setWarningAccepted(false)
      setCheckedFoodKey(
        String(
          food.food_name || food.name || form.foodName || ''
        )
          .trim()
          .toLowerCase()
      )

      return data.data
    } catch (err) {
      console.error('飲食警訊檢查失敗：', err)

      setSmartError(
        err.response?.data?.error ||
          err.message ||
          '食物檢查失敗'
      )

      return null
    } finally {
      setCheckingFood(false)
    }
  }

  const resetAddForm = () => {
    setForm({
      foodItemId: '',
      foodName: '',
      amountG: '',
      fedAt: getLocalDateTime(),
      notes: ''
    })

    setSelectedFood(null)

    setInputMode('manual')

    setFoodImage(null)
    setImagePreview('')

    setAiResult(null)
    setAiError('')

    setSmartDiet(null)
    setSmartError('')
    setFoodWarnings([])
    setCheckingFood(false)
    setWarningAccepted(false)
    setCheckedFoodKey('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const addRecord = useMutation({
    mutationFn: payload => api.post('/feeding', payload),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feeding'] })
      qc.invalidateQueries({ queryKey: ['feeding-stats'] })

      setShowAddModal(false)

      resetAddForm()
    }
  })

  const deleteRecord = useMutation({
    mutationFn: id => api.delete(`/feeding/${id}`),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feeding'] })
      qc.invalidateQueries({ queryKey: ['feeding-stats'] })
    }
  })

  const handleFoodSelect = async foodId => {
    const food = foods.find(f => String(f.id) === foodId)

    setSelectedFood(food || null)

    setForm(f => ({
      ...f,
      foodItemId: foodId,
      foodName: food?.name || ''
    }))

    setAiResult(null)
    setAiError('')
    setFoodWarnings([])
    setWarningAccepted(false)
    setCheckedFoodKey('')

    if (food) {
      await checkFoodSafety({
        ...food,
        food_name: food.name
      })
    }
  }

  // 原本的文字 AI 食物分析保留
  const handleAiAnalyze = async () => {
    if (!form.foodName) return

    setAiAnalyzing(true)
    setAiError('')
    setFoodWarnings([])
    setWarningAccepted(false)

    try {
      const { data } = await api.post('/food/ai-analyze', {
        foodName: form.foodName
      })

      if (!data.success) {
        throw new Error(data.error || 'AI 分析失敗')
      }

      const food = {
        ...data.data,
        name: form.foodName,
        food_name: data.data.food_name || form.foodName
      }

      setSelectedFood(food)
      setCheckedFoodKey('')

      await checkFoodSafety(food)
    } catch (err) {
      console.error(err)

      setAiError(
        err.response?.data?.error ||
          err.message ||
          'AI 分析失敗'
      )
    } finally {
      setAiAnalyzing(false)
    }
  }

  // 選擇圖片
  const handleImageChange = e => {
    const file = e.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAiError('請選擇圖片檔案')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setAiError('圖片大小不能超過 10MB')
      return
    }

    setFoodImage(file)
    setAiResult(null)
    setAiError('')

    const url = URL.createObjectURL(file)
    setImagePreview(url)
  }

  // 圖片辨識食物
  const handleImageAnalyze = async () => {
    if (!foodImage) {
      setAiError('請先選擇食物圖片')
      return
    }

    setAiAnalyzing(true)
    setAiError('')
    setAiResult(null)
    setFoodWarnings([])
    setWarningAccepted(false)

    try {
      const formData = new FormData()
      formData.append('image', foodImage)

      const response = await api.post(
        '/food/ai-analyze-image',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      const data = response.data

      if (!data.success) {
        throw new Error(data.error || '圖片分析失敗')
      }

      const result = data.data
      const foodName =
        result.food_name ||
        result.foodName ||
        '未知食物'

      const estimatedAmount = Number(
        result.estimated_weight_g ||
          result.estimatedAmountG ||
          100
      )

      const mealNutrition = calcNutrition(
        result,
        estimatedAmount
      )

      const normalizedResult = {
        ...result,
        foodName,
        estimatedAmountG: estimatedAmount,
        calories: mealNutrition.calories,
        proteinG: mealNutrition.proteinG,
        fatG: mealNutrition.fatG,
        carbG: mealNutrition.carbG
      }

      setAiResult(normalizedResult)
      setSelectedFood({
        ...result,
        name: foodName,
        food_name: foodName
      })

      setForm(f => ({
        ...f,
        foodItemId: '',
        foodName,
        amountG: estimatedAmount || f.amountG
      }))

      setCheckedFoodKey('')

      await checkFoodSafety({
        ...result,
        name: foodName,
        food_name: foodName
      })
    } catch (err) {
      console.error('圖片分析失敗：', err)

      setAiError(
        err.response?.data?.error ||
          err.message ||
          '圖片分析失敗，請稍後再試'
      )
    } finally {
      setAiAnalyzing(false)
    }
  }

  // 清除圖片
  const clearImage = () => {
    setFoodImage(null)
    setImagePreview('')
    setAiResult(null)
    setAiError('')
    setSelectedFood(null)
    setFoodWarnings([])
    setWarningAccepted(false)
    setCheckedFoodKey('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()

    if (!selectedPet) return

    const amount = Number(form.amountG)

    if (!form.foodName) {
      alert('請輸入食物名稱')
      return
    }

    if (!amount || amount <= 0) {
      alert('請輸入有效的食物份量')
      return
    }

    try {
      let foodForSave = selectedFood

      // 使用者只有輸入文字、還沒按 AI 時，儲存前也會自動分析
      if (!foodForSave) {
        setAiAnalyzing(true)

        const { data } = await api.post('/food/ai-analyze', {
          foodName: form.foodName
        })

        if (!data.success) {
          throw new Error(data.error || 'AI 分析失敗')
        }

        foodForSave = {
          ...data.data,
          name: form.foodName,
          food_name: data.data.food_name || form.foodName
        }

        setSelectedFood(foodForSave)
      }

      const currentFoodKey = String(form.foodName)
        .trim()
        .toLowerCase()

      // 食物內容改過、或還沒檢查時，儲存前一定再檢查一次
      if (checkedFoodKey !== currentFoodKey) {
        const safety = await checkFoodSafety({
          ...foodForSave,
          food_name:
            foodForSave.food_name ||
            foodForSave.name ||
            form.foodName
        })

        if (safety?.hasWarning) {
          return
        }
      }

      // 有警訊時，不強制阻止，但必須由使用者明確按「仍要儲存」
      if (foodWarnings.length > 0 && !warningAccepted) {
        return
      }

      const nutrition = calcNutrition(
        foodForSave,
        amount
      )

      addRecord.mutate({
        petId: selectedPet.id,
        foodItemId: form.foodItemId || null,
        foodName: form.foodName,
        amountG: amount,
        calories: nutrition.calories,
        proteinG: nutrition.proteinG,
        fatG: nutrition.fatG,
        carbG: nutrition.carbG,
        fedAt: form.fedAt,
        notes: form.notes
      })
    } catch (err) {
      console.error('新增餵食前分析失敗：', err)

      setAiError(
        err.response?.data?.error ||
          err.message ||
          '食物分析失敗，請稍後再試'
      )
    } finally {
      setAiAnalyzing(false)
    }
  }

  const goDay = offset => {
    const [y, m, d] = selectedDate
      .split('-')
      .map(Number)

    const date = new Date(y, m - 1, d)

    date.setDate(date.getDate() + offset)

    const next =
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, '0')}-` +
      `${String(date.getDate()).padStart(2, '0')}`

    if (next <= today) {
      setSelectedDate(next)
    }
  }

  const formatDate = dateStr => {
    if (!dateStr) return ''

    const d = dateStr.slice(0, 10)

    return d === today ? '今日' : d
  }

  const getAdvice = async () => {
    if (!selectedPet) return

    setLoadingAdvice(true)
    setAdviceError('')
    setDietAdvice('')

    try {
      const recentMeals =
        smartDiet?.recentMeals?.length > 0
          ? smartDiet.recentMeals
          : await loadRecentMeals()

      const { data } = await api.post(
        '/food/diet-advice',
        {
          pet: buildPetPayload(),
          healthSummary: buildHealthSummary(),
          recentMeals
        }
      )

      if (!data.success) {
        throw new Error(
          data.error || '取得飲食建議失敗'
        )
      }

      setDietAdvice(data.data.advice)

      if (data.data.recommendation) {
        setSmartDiet(prev => ({
          ...(prev || {}),
          history: data.data.history || prev?.history,
          recommendation: data.data.recommendation,
          recentMeals
        }))
      }
    } catch (err) {
      console.error('取得飲食建議失敗：', err)

      setAdviceError(
        err.response?.data?.error ||
          err.message ||
          '無法取得建議，請稍後再試'
      )
    } finally {
      setLoadingAdvice(false)
    }
  }

  const todayCalories = records.reduce(
    (s, r) =>
      s + Number(r.calories || 0),
    0
  )

  const todayProtein = records.reduce(
    (s, r) =>
      s + Number(r.protein_g || 0),
    0
  )

  const todayFat = records.reduce(
    (s, r) =>
      s + Number(r.fat_g || 0),
    0
  )

  const recommended =
    getRecommendedCalories(selectedPet)

  const caloriePct = recommended
    ? Math.min(
        (todayCalories / recommended) * 100,
        100
      )
    : 0

  const previewNutrition =
    selectedFood && form.amountG
      ? calcNutrition(
          selectedFood,
          Number(form.amountG)
        )
      : null

  const suggestedFood = (() => {
    const recommendationType =
      smartDiet?.recommendation?.type

    if (
      !recommendationType ||
      recommendationType === 'no_data' ||
      foods.length === 0
    ) {
      return null
    }

    const species = String(
      selectedPet?.species || ''
    ).toLowerCase()

    const candidates = foods.filter(food => {
      const name = String(food.name || '')

      if (
        species === 'dog' ||
        species.includes('狗') ||
        species.includes('犬')
      ) {
        return !name.includes('貓')
      }

      if (
        species === 'cat' ||
        species.includes('貓')
      ) {
        return !name.includes('犬') && !name.includes('狗')
      }

      return true
    })

    const mainFoods = candidates.filter(
      food => food.category !== 'snack'
    )

    const pool =
      mainFoods.length > 0
        ? mainFoods
        : candidates

    if (pool.length === 0) return null

    if (
      recommendationType === 'high_fat' ||
      recommendationType === 'high_fat_low_fiber'
    ) {
      return [...pool].sort((a, b) => {
        const fatDiff =
          Number(a.fat_pct || 999) -
          Number(b.fat_pct || 999)

        if (fatDiff !== 0) return fatDiff

        return (
          Number(b.fiber_pct || 0) -
          Number(a.fiber_pct || 0)
        )
      })[0]
    }

    if (recommendationType === 'low_fiber') {
      return [...pool].sort((a, b) => {
        const fiberDiff =
          Number(b.fiber_pct || 0) -
          Number(a.fiber_pct || 0)

        if (fiberDiff !== 0) return fiberDiff

        return (
          Number(a.fat_pct || 999) -
          Number(b.fat_pct || 999)
        )
      })[0]
    }

    if (recommendationType === 'high_calories') {
      return [...pool].sort(
        (a, b) =>
          Number(a.calories_per_100g || 9999) -
          Number(b.calories_per_100g || 9999)
      )[0]
    }

    return null
  })()

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all'

  return (
    <div className="flex h-screen overflow-hidden">

      {/* 左側：選擇寵物 */}
      <div className="w-52 bg-white border-r border-gray-200 flex flex-col shrink-0">

        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">
            選擇寵物
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">

          {pets.map(pet => (
            <button
              key={pet.id}
              onClick={() => {
                setSelectedPet(pet)
                setDietAdvice('')
                setAdviceError('')
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                selectedPet?.id === pet.id
                  ? 'bg-green-50 border-green-300'
                  : 'bg-gray-50 border-gray-100 hover:border-green-200'
              }`}
            >
              <span className="text-xl">
                {EMOJI[pet.species] || '🐾'}
              </span>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {pet.name}
                </p>

                <p className="text-xs text-gray-400">
                  {pet.weight
                    ? `${pet.weight}kg`
                    : pet.species}
                </p>
              </div>
            </button>
          ))}

        </div>

        <div className="p-3 border-t border-gray-100">
  <Link
    to="/food-database"
    className="group block w-full rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-3 hover:border-green-300 hover:shadow-sm transition-all"
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-white border border-green-100 flex items-center justify-center text-xl shrink-0 shadow-sm">
        🗄️
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-700 group-hover:text-green-600 transition-colors">
          食物資料庫
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          查看食物營養資訊
        </p>
      </div>
      <span className="text-green-500 group-hover:translate-x-0.5 transition-transform">
        →
      </span>
    </div>
  </Link>
</div>
      </div>

      {/* 右側主要內容 */}
      <div className="flex-1 overflow-y-auto">

        {!selectedPet ? (
          <div className="flex items-center justify-center h-full flex-col gap-3 text-gray-400">

            <span className="text-5xl">
              🍽️
            </span>

            <p className="text-gray-500 font-semibold">
              請選擇寵物
            </p>

          </div>
        ) : (
          <div className="p-6 max-w-4xl">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">

              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {EMOJI[selectedPet.species]}{' '}
                  {selectedPet.name} 的飲食管理
                </h1>

                <p className="text-sm text-gray-400 mt-0.5">
                  記錄和分析每日餵食狀況
                </p>
              </div>

              <div className="flex items-center gap-3">

                <div className="flex items-center gap-1.5">

                  <button
                    onClick={() => goDay(-1)}
                    className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors text-lg"
                  >
                    ‹
                  </button>

                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e =>
                      setSelectedDate(
                        e.target.value
                      )
                    }
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />

                  <button
                    onClick={() => goDay(1)}
                    disabled={selectedDate >= today}
                    className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30 text-lg"
                  >
                    ›
                  </button>

                  {selectedDate !== today && (
                    <button
                      onClick={() =>
                        setSelectedDate(today)
                      }
                      className="text-xs text-green-500 hover:underline font-medium px-1"
                    >
                      今天
                    </button>
                  )}

                </div>

                <button
                  onClick={openAddModal}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  ＋ 新增餵食
                </button>

              </div>
            </div>

            {/* 統計卡片 */}
            <div className="grid grid-cols-4 gap-3 mb-6">

              <div className="bg-white border border-gray-200 rounded-xl p-4">

                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                  {formatDate(selectedDate)} 熱量
                </p>

                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {todayCalories.toFixed(0)}
                  <span className="text-sm font-normal text-gray-400">
                    {' '}kcal
                  </span>
                </p>

                {recommended && (
                  <div className="mt-2">

                    <div className="flex justify-between text-xs text-gray-400 mb-1">

                      <span>
                        建議 {recommended} kcal
                      </span>

                      <span>
                        {caloriePct.toFixed(0)}%
                      </span>

                    </div>

                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">

                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${caloriePct}%`,
                          backgroundColor:
                            caloriePct > 100
                              ? '#ef4444'
                              : caloriePct > 80
                              ? '#f97316'
                              : '#22c55e'
                        }}
                      />

                    </div>

                  </div>
                )}

              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">

                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                  蛋白質
                </p>

                <p className="text-2xl font-bold text-blue-500 mt-1">
                  {todayProtein.toFixed(1)}
                  <span className="text-sm font-normal text-gray-400">
                    {' '}g
                  </span>
                </p>

              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">

                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                  脂肪
                </p>

                <p className="text-2xl font-bold text-amber-500 mt-1">
                  {todayFat.toFixed(1)}
                  <span className="text-sm font-normal text-gray-400">
                    {' '}g
                  </span>
                </p>

              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">

                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                  餵食次數
                </p>

                <p className="text-2xl font-bold text-green-500 mt-1">
                  {records.length}
                  <span className="text-sm font-normal text-gray-400">
                    {' '}次
                  </span>
                </p>

              </div>

            </div>

            {/* 餵食紀錄 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

              <div className="px-5 py-4 border-b border-gray-100">

                <h2 className="text-sm font-bold text-gray-800">
                  {formatDate(selectedDate)} 餵食紀錄
                </h2>

              </div>

              {records.length === 0 ? (
                <div className="py-16 text-center">

                  <p className="text-4xl mb-3">
                    🍽️
                  </p>

                  <p className="text-gray-400 text-sm mb-4">
                    這天還沒有餵食紀錄
                  </p>

                  {selectedDate === today && (
                    <button
                      onClick={openAddModal}
                      className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      新增第一筆
                    </button>
                  )}

                </div>
              ) : (
                <div className="divide-y divide-gray-50">

                  {records.map(record => (
                    <div
                      key={record.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                    >

                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                        {record.food_name?.includes('乾')
                          ? '🥣'
                          : record.food_name?.includes('罐') ||
                            record.food_name?.includes('濕')
                          ? '🥫'
                          : '🍖'}
                      </div>

                      <div className="flex-1 min-w-0">

                        <p className="text-sm font-semibold text-gray-800">
                          {record.food_name}
                        </p>

                        <p className="text-xs text-gray-400 mt-0.5">

                          {record.amount_g}g

                          {record.calories
                            ? ` · ${Number(record.calories).toFixed(0)} kcal`
                            : ''}

                          {record.protein_g
                            ? ` · 蛋白質 ${Number(record.protein_g).toFixed(1)}g`
                            : ''}

                          {' · '}

                          {new Date(
                            record.fed_at
                          ).toLocaleTimeString(
                            'zh-TW',
                            {
                              hour: '2-digit',
                              minute: '2-digit'
                            }
                          )}

                        </p>

                        {record.notes && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            注：{record.notes}
                          </p>
                        )}

                      </div>

                      {record.calories && (
                        <p className="text-sm font-bold text-gray-700 shrink-0">
                          {Number(record.calories).toFixed(0)} kcal
                        </p>
                      )}

                      <button
                        onClick={() => {
                          if (confirm('確定刪除？')) {
                            deleteRecord.mutate(
                              record.id
                            )
                          }
                        }}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        🗑️
                      </button>

                    </div>
                  ))}

                </div>
              )}

            </div>

            {/* 近期熱量趨勢 */}
            {dailyStats.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">

                <h2 className="text-sm font-bold text-gray-800 mb-4">
                  近期熱量趨勢
                </h2>

                <div
                  style={{
                    height: '140px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px'
                  }}
                >

                  {dailyStats
                    .slice(0, 7)
                    .reverse()
                    .map((stat, i) => {

                      const max = Math.max(
                        ...dailyStats
                          .slice(0, 7)
                          .map(s =>
                            Number(
                              s.total_calories || 0
                            )
                          )
                      )

                      const cal = Number(
                        stat.total_calories || 0
                      )

                      const barHeight =
                        max > 0
                          ? Math.max(
                              (cal / max) * 100,
                              10
                            )
                          : 10

                      const dateStr = (() => {
                        const value = String(
                          stat.date
                        )

                        if (
                          value.includes('T') &&
                          value.endsWith('Z')
                        ) {
                          const d =
                            new Date(value)

                          return (
                            `${d.getFullYear()}-` +
                            `${String(
                              d.getMonth() + 1
                            ).padStart(2, '0')}-` +
                            `${String(
                              d.getDate()
                            ).padStart(2, '0')}`
                          )
                        }

                        return value.slice(0, 10)
                      })()

                      const isSelected =
                        dateStr === selectedDate

                      return (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                          onClick={() =>
                            setSelectedDate(
                              dateStr
                            )
                          }
                        >

                          <span
                            style={{
                              fontSize: '10px',
                              color: '#9ca3af',
                              height: '16px',
                              lineHeight: '16px'
                            }}
                          >
                            {cal > 0
                              ? cal.toFixed(0)
                              : ''}
                          </span>

                          <div
                            style={{
                              width: '100%',
                              height: `${barHeight}px`,
                              maxHeight: '100px',
                              backgroundColor:
                                isSelected
                                  ? '#1D9E75'
                                  : '#9FE1CB',
                              borderRadius:
                                '4px 4px 0 0',
                              minHeight: '8px',
                              transition:
                                'background-color 0.2s'
                            }}
                          />

                          <span
                            style={{
                              fontSize: '10px',
                              color: isSelected
                                ? '#1D9E75'
                                : '#9ca3af',
                              fontWeight:
                                isSelected
                                  ? '600'
                                  : '400'
                            }}
                          >
                            {dateStr.slice(5)}
                          </span>

                        </div>
                      )
                    })}

                </div>

                {recommended && (
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    建議每日熱量：
                    {recommended} kcal
                    （根據體重 {selectedPet.weight} kg 估算）
                  </p>
                )}

              </div>
            )}

            {/* AI 飲食建議 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">

              <div className="flex items-center justify-between mb-3">

                <div className="flex items-center gap-2">

                  <span className="text-lg">
                    🤖
                  </span>

                  <h2 className="text-sm font-bold text-gray-800">
                    AI 個人化飲食建議
                  </h2>

                  <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full">
                    Powered by Groq
                  </span>

                </div>

                <button
                  onClick={getAdvice}
                  disabled={loadingAdvice}
                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {loadingAdvice
                    ? '分析中...'
                    : '✨ 取得建議'}
                </button>

              </div>

              {!dietAdvice &&
                !loadingAdvice &&
                !adviceError && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">

                    <p className="text-xs text-gray-400">
                      點擊「取得建議」，AI 將根據{' '}
                      <span className="text-green-600 font-medium">
                        {selectedPet?.name}
                      </span>{' '}
                      的健康紀錄與近期飲食，提供個人化飲食建議
                    </p>

                    {consultations.length > 0 && (
                      <p className="text-xs text-green-500 mt-1">
                        已找到 {consultations.length} 筆健康諮詢紀錄
                      </p>
                    )}

                  </div>
                )}

              {loadingAdvice && (
                <div className="bg-gray-50 rounded-xl p-6 text-center">

                  <div className="flex gap-1.5 justify-center mb-2">

                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-green-400 rounded-full animate-bounce"
                        style={{
                          animationDelay: `${i * 0.15}s`
                        }}
                      />
                    ))}

                  </div>

                  <p className="text-xs text-gray-400">
                    AI 正在分析健康與近期飲食紀錄...
                  </p>

                </div>
              )}

              {adviceError && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs text-red-500">
                    {adviceError}
                  </p>
                </div>
              )}

              {dietAdvice && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">

                  <div
                    className="text-sm text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: dietAdvice
                        .replace(
                          /\*\*(.*?)\*\*/g,
                          '<strong>$1</strong>'
                        )
                        .replace(
                          /\n/g,
                          '<br/>'
                        )
                    }}
                  />

                  <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-between">

                    <p className="text-xs text-gray-400">
                      ⚠️ 此建議僅供參考，請諮詢專業獸醫
                    </p>

                    <button
                      onClick={getAdvice}
                      className="text-xs text-green-500 hover:underline font-medium"
                    >
                      重新分析
                    </button>

                  </div>

                </div>
              )}

            </div>

          </div>
        )}

      </div>

      {/* 新增餵食 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 max-h-[90vh] overflow-y-auto">

            <div className="p-6">

              {/* Modal Header */}
              <div className="flex items-center justify-between mb-5">

                <div>
                  <h2 className="text-base font-bold text-gray-800">
                    新增餵食紀錄
                  </h2>

                  <p className="text-xs text-gray-400 mt-1">
                    可以使用圖片辨識或手動輸入
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetAddForm()
                  }}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm"
                >
                  ✕
                </button>

              </div>

              {/* 智慧推薦 */}
              <div className="mb-5">
                {smartLoading && (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-green-700">
                      ✨ 正在分析最近飲食...
                    </p>
                    <p className="text-xs text-green-500 mt-1">
                      系統會參考近期餵食、營養與健康紀錄
                    </p>
                  </div>
                )}

                {smartError && !smartLoading && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs text-red-500">
                      {smartError}
                    </p>
                  </div>
                )}

                {smartDiet?.recommendation && !smartLoading && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                        ✨
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-green-600">
                          系統推薦
                        </p>

                        <p className="text-sm font-bold text-gray-800 mt-1">
                          {smartDiet.recommendation.title}
                        </p>

                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                          {smartDiet.recommendation.recommendation}
                        </p>

                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                          原因：{smartDiet.recommendation.reason}
                        </p>

                        {smartDiet.history?.hasData && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            <span className={`text-[11px] px-2 py-1 rounded-full ${
                              smartDiet.history.fatStatus === '正常'
                                ? 'bg-white text-green-600'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              脂肪：{smartDiet.history.fatStatus}
                            </span>

                            <span className={`text-[11px] px-2 py-1 rounded-full ${
                              smartDiet.history.fiberStatus === '正常'
                                ? 'bg-white text-green-600'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              纖維：{smartDiet.history.fiberStatus}
                            </span>

                            <span className="text-[11px] px-2 py-1 rounded-full bg-white text-gray-500">
                              已分析 {smartDiet.history.mealCount} 筆
                            </span>
                          </div>
                        )}

                        {suggestedFood && (
                          <button
                            type="button"
                            onClick={() =>
                              handleFoodSelect(String(suggestedFood.id))
                            }
                            className="mt-3 w-full bg-green-500 hover:bg-green-600 text-white rounded-lg py-2 text-xs font-semibold transition-colors"
                          >
                            ✓ 採用推薦：{suggestedFood.name}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 模式切換 */}
              <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 mb-5">

                <button
                  type="button"
                  onClick={() => {
                    setInputMode('image')
                    setAiError('')
                  }}
                  className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    inputMode === 'image'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📷 圖片辨識
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInputMode('manual')
                    setAiError('')
                  }}
                  className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    inputMode === 'manual'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ✏️ 手動輸入
                </button>

              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >

                {/* ========================= */}
                {/* 圖片辨識模式 */}
                {/* ========================= */}
                {inputMode === 'image' && (
                  <div className="space-y-4">

                    {!imagePreview ? (
                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="w-full border-2 border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50 rounded-xl p-8 transition-all"
                      >

                        <div className="text-4xl mb-3">
                          📷
                        </div>

                        <p className="text-sm font-semibold text-gray-700">
                          上傳食物圖片
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          JPG、PNG，最大 10MB
                        </p>

                      </button>
                    ) : (
                      <div className="relative">

                        <img
                          src={imagePreview}
                          alt="食物預覽"
                          className="w-full h-48 object-cover rounded-xl border border-gray-200"
                        />

                        <button
                          type="button"
                          onClick={clearImage}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/60 text-white rounded-full hover:bg-black/80"
                        >
                          ✕
                        </button>

                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />

                    {foodImage && (
                      <button
                        type="button"
                        onClick={handleImageAnalyze}
                        disabled={aiAnalyzing}
                        className="w-full bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {aiAnalyzing
                          ? '🤖 AI 正在辨識食物...'
                          : '🤖 開始辨識食物與營養'}
                      </button>
                    )}

                    {aiError && (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                        <p className="text-xs text-red-500">
                          {aiError}
                        </p>
                      </div>
                    )}

                    {aiResult && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">

                        <div className="flex items-center justify-between mb-3">

                          <div>
                            <p className="text-xs font-semibold text-green-700">
                              🤖 AI 辨識結果
                            </p>

                            {aiResult.confidence != null && (
                              <p className="text-xs text-green-500 mt-0.5">
                                信心度：
                                {Math.round(
                                  Number(
                                    aiResult.confidence
                                  ) * 100
                                )}%
                              </p>
                            )}

                          </div>

                          <span className="text-xs bg-white text-green-600 px-2 py-1 rounded-full">
                            可修改
                          </span>

                        </div>

                        <div className="grid grid-cols-2 gap-2">

                          <div className="bg-white rounded-lg p-2.5">

                            <p className="text-xs text-gray-400">
                              食物
                            </p>

                            <p className="text-sm font-bold text-gray-700">
                              {aiResult.foodName || '未知'}
                            </p>

                          </div>

                          <div className="bg-white rounded-lg p-2.5">

                            <p className="text-xs text-gray-400">
                              估計份量
                            </p>

                            <p className="text-sm font-bold text-gray-700">
                              {aiResult.estimatedAmountG != null
                                ? `${aiResult.estimatedAmountG} g`
                                : '未估計'}
                            </p>

                          </div>

                          <div className="bg-white rounded-lg p-2.5">

                            <p className="text-xs text-gray-400">
                              熱量
                            </p>

                            <p className="text-sm font-bold text-green-600">
                              {aiResult.calories != null
                                ? `${aiResult.calories} kcal`
                                : '—'}
                            </p>

                          </div>

                          <div className="bg-white rounded-lg p-2.5">

                            <p className="text-xs text-gray-400">
                              蛋白質
                            </p>

                            <p className="text-sm font-bold text-gray-700">
                              {aiResult.proteinG != null
                                ? `${aiResult.proteinG} g`
                                : '—'}
                            </p>

                          </div>

                          <div className="bg-white rounded-lg p-2.5">

                            <p className="text-xs text-gray-400">
                              脂肪
                            </p>

                            <p className="text-sm font-bold text-gray-700">
                              {aiResult.fatG != null
                                ? `${aiResult.fatG} g`
                                : '—'}
                            </p>

                          </div>

                          <div className="bg-white rounded-lg p-2.5">

                            <p className="text-xs text-gray-400">
                              碳水
                            </p>

                            <p className="text-sm font-bold text-gray-700">
                              {aiResult.carbG != null
                                ? `${aiResult.carbG} g`
                                : '—'}
                            </p>

                          </div>

                        </div>

                        {aiResult.note && (
                          <p className="text-xs text-green-600 mt-3">
                            {aiResult.note}
                          </p>
                        )}

                      </div>
                    )}

                    {/* AI 結果可以繼續修改 */}
                    {aiResult && (
                      <div className="space-y-3">

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                            食物名稱
                          </label>

                          <input
                            required
                            value={form.foodName}
                            onChange={e => {
                              setForm(f => ({
                                ...f,
                                foodItemId: '',
                                foodName: e.target.value
                              }))

                              setSelectedFood(null)
                              setFoodWarnings([])
                              setWarningAccepted(false)
                              setCheckedFoodKey('')
                            }}
                            className={inputCls}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                            份量 (g)
                          </label>

                          <input
                            type="number"
                            required
                            min="0.1"
                            step="0.1"
                            value={form.amountG}
                            onChange={e =>
                              setForm(f => ({
                                ...f,
                                amountG:
                                  e.target.value
                              }))
                            }
                            className={inputCls}
                          />

                          <p className="text-xs text-gray-400 mt-1">
                            如果 AI 估算不準，可以在這裡修改。
                          </p>
                        </div>

                      </div>
                    )}

                  </div>
                )}

                {/* ========================= */}
                {/* 手動輸入模式 */}
                {/* ========================= */}
                {inputMode === 'manual' && (
                  <>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        從食物資料庫選擇
                      </label>

                      <select
                        value={form.foodItemId}
                        onChange={e =>
                          handleFoodSelect(
                            e.target.value
                          )
                        }
                        className={inputCls}
                      >

                        <option value="">
                          -- 從資料庫選擇 --
                        </option>

                        {foods.map(f => (
                          <option
                            key={f.id}
                            value={f.id}
                          >
                            {f.name}
                            {f.brand
                              ? ` (${f.brand})`
                              : ''}
                          </option>
                        ))}

                      </select>
                    </div>

                    <div>

                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        食物名稱 *
                        <span className="ml-1 text-gray-300 font-normal">
                          （可手動輸入）
                        </span>
                      </label>

                      <div className="flex gap-2">

                        <input
                          required
                          value={form.foodName}
                          onChange={e => {
                            setForm(f => ({
                              ...f,
                              foodItemId: '',
                              foodName: e.target.value
                            }))

                            setSelectedFood(null)
                            setAiResult(null)
                            setFoodWarnings([])
                            setWarningAccepted(false)
                            setCheckedFoodKey('')
                          }}
                          placeholder="例如：希爾思乾糧"
                          className={inputCls}
                        />

                        {form.foodName &&
                          !selectedFood && (
                            <button
                              type="button"
                              onClick={
                                handleAiAnalyze
                              }
                              disabled={
                                aiAnalyzing
                              }
                              className="shrink-0 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {aiAnalyzing
                                ? '...'
                                : '🤖 AI'}
                            </button>
                          )}

                      </div>

                    </div>

                    {selectedFood && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3">

                        <p className="text-xs font-semibold text-green-700 mb-2">
                          {selectedFood.notes
                            ? '🤖 AI 估算結果'
                            : '📋 資料庫資料'}
                        </p>

                        <div className="grid grid-cols-4 gap-2 text-center">

                          {[
                            [
                              '熱量',
                              selectedFood.calories_per_100g,
                              'kcal/100g'
                            ],
                            [
                              '蛋白質',
                              selectedFood.protein_pct,
                              '%'
                            ],
                            [
                              '脂肪',
                              selectedFood.fat_pct,
                              '%'
                            ],
                            [
                              '碳水',
                              selectedFood.carb_pct,
                              '%'
                            ]
                          ].map(
                            ([label, val, unit]) => (
                              <div
                                key={label}
                                className="bg-white rounded-lg p-2"
                              >

                                <p className="text-xs text-gray-400">
                                  {label}
                                </p>

                                <p className="text-sm font-bold text-gray-700">
                                  {val
                                    ? `${val}`
                                    : '—'}
                                </p>

                                <p className="text-xs text-gray-400">
                                  {unit}
                                </p>

                              </div>
                            )
                          )}

                        </div>

                        {selectedFood.notes && (
                          <p className="text-xs text-green-600 mt-2">
                            注：{selectedFood.notes}
                          </p>
                        )}

                      </div>
                    )}

                  </>
                )}

                {/* 飲食警訊 */}
                {checkingFood && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">
                      🔎 正在檢查這個食物是否適合目前狀況...
                    </p>
                  </div>
                )}

                {foodWarnings.length > 0 && !checkingFood && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl">⚠️</span>

                      <div className="flex-1">
                        <p className="text-sm font-bold text-amber-800">
                          飲食警訊
                        </p>

                        <div className="space-y-3 mt-2">
                          {foodWarnings.map((warning, index) => (
                            <div
                              key={`${warning.title}-${index}`}
                              className="bg-white/70 rounded-lg p-3"
                            >
                              <p className="text-xs font-bold text-gray-800">
                                {warning.title}
                              </p>

                              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                {warning.reason}
                              </p>

                              {warning.suggestion && (
                                <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">
                                  建議：{warning.suggestion}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {!warningAccepted ? (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => {
                                setFoodWarnings([])
                                setWarningAccepted(false)
                                setCheckedFoodKey('')
                              }}
                              className="border border-amber-300 bg-white text-amber-700 rounded-lg py-2 text-xs font-semibold hover:bg-amber-50"
                            >
                              修改食物
                            </button>

                            <button
                              type="button"
                              onClick={() => setWarningAccepted(true)}
                              className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 text-xs font-semibold"
                            >
                              仍要儲存
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 bg-white/80 border border-amber-200 rounded-lg px-3 py-2">
                            <p className="text-xs text-amber-700 font-medium">
                              ✓ 已確認警訊，可繼續儲存此紀錄
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 份量與時間 */}
                <div className="grid grid-cols-2 gap-3">

                  <div>

                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      份量 (g) *
                    </label>

                    <input
                      type="number"
                      required
                      min="0.1"
                      step="0.1"
                      value={form.amountG}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          amountG:
                            e.target.value
                        }))
                      }
                      placeholder="例如：60"
                      className={inputCls}
                    />

                  </div>

                  <div>

                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      餵食時間
                    </label>

                    <input
                      type="datetime-local"
                      value={form.fedAt}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          fedAt:
                            e.target.value
                        }))
                      }
                      className={inputCls}
                    />

                  </div>

                </div>

                {/* 營養結果 */}
                {previewNutrition?.calories != null && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">

                    <div className="flex items-center justify-between mb-2">

                      <p className="text-xs text-gray-500">
                        {aiResult
                          ? '🤖 AI 估算這餐營養'
                          : '📋 這餐營養'}
                      </p>

                      {aiResult && (
                        <span className="text-xs text-gray-400">
                          圖片估算
                        </span>
                      )}

                    </div>

                    <div className="grid grid-cols-4 gap-2">

                      <div className="text-center">
                        <p className="text-xs text-gray-400">
                          熱量
                        </p>
                        <p className="text-sm font-bold text-green-600">
                          {previewNutrition.calories}
                        </p>
                        <p className="text-xs text-gray-400">
                          kcal
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-xs text-gray-400">
                          蛋白質
                        </p>
                        <p className="text-sm font-bold text-blue-500">
                          {previewNutrition.proteinG ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400">
                          g
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-xs text-gray-400">
                          脂肪
                        </p>
                        <p className="text-sm font-bold text-amber-500">
                          {previewNutrition.fatG ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400">
                          g
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-xs text-gray-400">
                          碳水
                        </p>
                        <p className="text-sm font-bold text-purple-500">
                          {previewNutrition.carbG ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400">
                          g
                        </p>
                      </div>

                    </div>

                  </div>
                )}

                {/* 備註 */}
                <div>

                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    備注
                  </label>

                  <input
                    value={form.notes}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        notes: e.target.value
                      }))
                    }
                    placeholder="選填"
                    className={inputCls}
                  />

                </div>

                {/* 按鈕 */}
                <div className="flex gap-3 pt-1">

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      resetAddForm()
                    }}
                    className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-500 hover:bg-gray-50 font-medium transition-colors"
                  >
                    取消
                  </button>

                  <button
                    type="submit"
                    disabled={
                      addRecord.isPending ||
                      aiAnalyzing ||
                      checkingFood ||
                      !form.foodName ||
                      !form.amountG ||
                      (foodWarnings.length > 0 && !warningAccepted)
                    }
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {addRecord.isPending
                      ? '新增中...'
                      : checkingFood
                      ? '檢查中...'
                      : warningAccepted
                      ? '⚠️ 確認儲存'
                      : '新增餵食紀錄'}
                  </button>

                </div>

              </form>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}