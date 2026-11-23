import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import PixelIcon from '../components/brand/PixelIcon'
import PixelAssistant from '../components/brand/PixelAssistant'
import AlertIcon from '../components/ui/AlertIcon'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { PetDrawer, PetPickerBar } from '../components/layout/PetDrawer'
import PetIcon from '../components/brand/PetIcon'
import DietPreferencesModal from '../components/diet/DietPreferencesModal'
import FoodCheckSteps from '../components/diet/FoodCheckSteps'
import DietTodayTab from '../components/diet/DietTodayTab'
import DietTrendTab from '../components/diet/DietTrendTab'
import DietAdviceTab from '../components/diet/DietAdviceTab'

// 健康事件嚴重程度（與健康諮詢頁一致）
const HEALTH_SEVERITY = {
  normal: {
    label: '一般',
    className: 'bg-pine-50 text-pine-700 border-pine-100'
  },
  urgent: {
    label: '建議儘快就醫',
    className: 'bg-honey-50 text-honey-text border-honey-200'
  },
  emergency: {
    label: '緊急',
    className: 'bg-clay-50 text-clay border-clay-200'
  }
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

  // 把後端時間轉成 datetime-local 需要的格式
  const toLocalInput = value => {
    if (!value) return getLocalDateTime()
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return getLocalDateTime()
    const offset = date.getTimezoneOffset()
    return new Date(date.getTime() - offset * 60000)
      .toISOString()
      .slice(0, 16)
  }

  const inferMealType = value => {
    const date = value ? new Date(value) : new Date()
    const hour = date.getHours()
    if (hour < 10) return 'breakfast'
    if (hour < 15) return 'lunch'
    if (hour < 21) return 'dinner'
    return 'late'
  }

  const today = getLocalDate()

  const [chosenPet, setChosenPet] = useState(null)
  const [petOpen, setPetOpen] = useState(false) // 手機寵物抽屜
  const [showPastHealthEvents, setShowPastHealthEvents] = useState(false) // 展開已過注意期的健康事件
  const [selectedDate, setSelectedDate] = useState(today)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [feedingKey, setFeedingKey] = useState('')

  const [form, setForm] = useState({
    foodItemId: '',
    foodName: '',
    amountG: '',
    fedAt: getLocalDateTime(),
    mealType: 'breakfast',
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

  // AI 飲食建議的參考來源與追加提問（追問沿用同一份資料）
  const [adviceSources, setAdviceSources] = useState([])
  const [adviceQuestion, setAdviceQuestion] = useState('')
  const [adviceFollowups, setAdviceFollowups] = useState([])
  const [sendingQuestion, setSendingQuestion] = useState(false)

  // 智慧餵食推薦 / 飲食警訊
  const [smartDiet, setSmartDiet] = useState(null)
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartError, setSmartError] = useState('')
  const [foodWarnings, setFoodWarnings] = useState([])
  const [checkingFood, setCheckingFood] = useState(false)
  const [warningAccepted, setWarningAccepted] = useState(false)
  const [checkedFoodKey, setCheckedFoodKey] = useState('')

  // 飼主的飲食偏好視窗
  const [showPrefs, setShowPrefs] = useState(false)

  // 頁面分頁：today｜trends｜advice
  const [activeTab, setActiveTab] = useState('today')

  // 需要使用者按「仍要儲存」確認的警訊（維持原本的行為），
  // 以及只是提醒、不阻擋操作的警訊（例如健康歷史提醒）
  const ackWarnings = foodWarnings.filter(w => w.requireAck !== false)
  const advisoryWarnings = foodWarnings.filter(w => w.requireAck === false)

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  // 沒手動挑選時，直接以第一隻寵物為目前對象（用推導取代 effect 內 setState）
  const selectedPet = chosenPet || pets[0] || null

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

  // 今日飲食計畫（含每日建議範圍）
  const {
    data: mealPlan,
    isLoading: planLoading,
    isError: planError,
    refetch: refetchPlan
  } = useQuery({
    queryKey: ['meal-plan', selectedPet?.id],
    queryFn: () =>
      api
        .get(`/food/meal-plan/${selectedPet.id}`)
        .then(r => r.data.data),
    enabled: !!selectedPet,
    staleTime: 30_000
  })

  // 一週熱量趨勢（實際攝取＋每日建議範圍）
  const {
    data: trendData,
    isLoading: trendLoading,
    isError: trendError
  } = useQuery({
    queryKey: ['feeding-trends', selectedPet?.id],
    queryFn: () =>
      api
        .get(`/feeding/pet/${selectedPet.id}/trends?days=7`)
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

  // 近期與飲食有關的重要健康紀錄（由健康諮詢 AI 自動記錄）
  const { data: dietHealthEvents = [] } = useQuery({
    queryKey: ['diet-health-events', selectedPet?.id],
    queryFn: () =>
      api
        .get(
          `/health-records/pet/${selectedPet.id}/diet-relevant?days=14`
        )
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

  // 飲食異常警訊（依近 7 天餵食紀錄分析：食物集中、熱量、營養比例）
  const { data: dietAlerts } = useQuery({
    queryKey: ['feeding-alerts', selectedPet?.id],
    queryFn: () =>
      api
        .get(`/feeding/pet/${selectedPet.id}/diet-alerts`)
        .then(r => r.data.data),
    enabled: !!selectedPet
  })


  // 注意期內的事件才算「提醒」；已過注意期的預設收合，不佔版面也不計入數字
  const activeHealthEvents = dietHealthEvents.filter(e => e.is_active)
  const pastHealthEvents = dietHealthEvents.filter(e => !e.is_active)

  const healthAlertCount =
    activeHealthEvents.length +
    (dietAlerts?.alerts?.length || 0)

  // 把結構化的健康事件整理成給飲食 AI 的文字
  const buildHealthEventSummary = () => {
    if (dietHealthEvents.length === 0) return ''

    const lines = dietHealthEvents.map((e, i) => {
      const info = e.diet_info || {}
      const severity =
        HEALTH_SEVERITY[e.severity]?.label || '未分級'

      const parts = [
        `${i + 1}. ${e.date_str} ${e.title}` +
          `（${severity}，` +
          (e.is_active
            ? `飲食注意事項有效至 ${e.diet_until_str}`
            : '注意期間已結束，僅供參考') +
          '）'
      ]

      if (e.description) parts.push(`   狀況：${e.description}`)
      if (info.symptoms?.length)
        parts.push(`   症狀：${info.symptoms.join('、')}`)
      if (info.dietNotes)
        parts.push(`   飲食注意：${info.dietNotes}`)
      if (info.avoidFoods?.length)
        parts.push(`   應避免：${info.avoidFoods.join('、')}`)
      if (info.dietAdvice?.length)
        parts.push(`   建議：${info.dietAdvice.join('；')}`)

      return parts.join('\n')
    })

    return (
      '【近期重要健康事件（來自健康諮詢 AI 的紀錄，' +
      '推薦飲食或檢查食物時必須納入考量）】\n' +
      lines.join('\n')
    )
  }

  const buildHealthSummary = () => {
    const eventSummary = buildHealthEventSummary()

    // 有結構化事件時，對話只帶最近幾則，避免內容過長
    const recentConsults = consultations
      .slice(eventSummary ? -6 : -10)
      .map(
        m =>
          `${m.role === 'user' ? '飼主' : 'AI'}：${m.content}`
      )
      .join('\n')

    const sections = []

    if (eventSummary) sections.push(eventSummary)

    if (recentConsults)
      sections.push(`【近期健康諮詢對話】\n${recentConsults}`)

    return sections.join('\n\n') || '目前沒有健康諮詢紀錄'
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

  // 一筆餵食紀錄 → 送給後端分析的格式（附上食物資料庫的營養係數）
  const mapRecordToMeal = record => {
    const dbFood = foods.find(food =>
      (record.food_item_id &&
        String(food.id) === String(record.food_item_id)) ||
      food.name === record.food_name
    )

    const meal = {
      food_name: record.food_name,
      amount_g: Number(record.amount_g || 0),
      meal_type: record.meal_type || null,
      fed_at: record.fed_at || record.created_at || null
    }

    if (dbFood) {
      meal.calories_per_100g = dbFood.calories_per_100g
      meal.protein_pct = dbFood.protein_pct
      meal.fat_pct = dbFood.fat_pct
      meal.carb_pct = dbFood.carb_pct
      meal.fiber_pct = dbFood.fiber_pct
    } else if (meal.amount_g > 0) {
      // 找不到食物資料庫時，改用紀錄當下儲存的營養數值回推每 100g
      const per100 = value =>
        Number.isFinite(Number(value)) && Number(value) > 0
          ? (Number(value) / meal.amount_g) * 100
          : undefined

      meal.calories_per_100g = per100(record.calories)
      meal.protein_pct = per100(record.protein_g)
      meal.fat_pct = per100(record.fat_g)
      meal.carb_pct = per100(record.carb_g)
    }

    return meal
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
      .map(mapRecordToMeal)
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
    setEditingRecord(null)
    resetAddForm()
    setShowAddModal(true)

    // Modal 開啟後立即依照過去飲食取得推薦
    loadSmartRecommendation()
  }

  // 編輯既有餵食紀錄：不會再新增一筆
  const openEditModal = record => {
    setEditingRecord(record)

    const matchedFood = foods.find(
      food =>
        (record.food_item_id &&
          String(food.id) === String(record.food_item_id)) ||
        food.name === record.food_name
    )

    setSelectedFood(matchedFood || null)

    setForm({
      foodItemId: record.food_item_id ? String(record.food_item_id) : '',
      foodName: record.food_name || '',
      amountG: record.amount_g ? String(Number(record.amount_g)) : '',
      fedAt: toLocalInput(record.fed_at),
      mealType: record.meal_type || inferMealType(record.fed_at),
      notes: record.notes || ''
    })

    setAiResult(null)
    setAiError('')
    setInputMode('manual')
    setFoodImage(null)
    setImagePreview('')
    setFoodWarnings([])
    setWarningAccepted(false)
    setCheckedFoodKey('')
    setSmartDiet(null)
    setSmartError('')

    setShowAddModal(true)
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
        // 後端會依 petId 讀取這隻寵物近期的健康歷史
        petId: selectedPet.id,
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
      mealType: inferMealType(),
      notes: ''
    })

    setEditingRecord(null)
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

  // 依照飲食計畫餵食：帶入建議的食物與份量，
  // 然後和「自己選擇」一樣先經過餵食前檢查，最後由使用者確認。
  const openPlanMeal = async (meal, option) => {
    resetAddForm()
    setShowAddModal(true)

    const food = foods.find(f => String(f.id) === String(option.foodId))

    if (!food) return

    setSelectedFood(food)

    setForm(f => ({
      ...f,
      foodItemId: String(food.id),
      foodName: food.name,
      amountG: option.amountG ? String(option.amountG) : '',
      fedAt: getLocalDateTime(),
      mealType: meal.key,
      notes: `依飲食計畫（${meal.label}）`
    }))

    await checkFoodSafety({
      ...food,
      food_name: food.name
    })
  }

  // 依計畫餵食：沒有需要確認的警訊時，直接建立「一筆」餵食紀錄。
  // 有阻擋型警訊或需要調整份量時，才開啟原本的確認視窗。
  const feedFromPlan = async (meal, option) => {
    if (!selectedPet || !option?.foodId) return

    const food = foods.find(f => String(f.id) === String(option.foodId))

    if (!food || !option.amountG) {
      openPlanMeal(meal, option)
      return
    }

    setFeedingKey(meal.key)

    try {
      const safety = await checkFoodSafety({
        ...food,
        food_name: food.name
      })

      if (!safety) return

      const blocking = (safety.warnings || []).filter(
        warning => warning.requireAck !== false
      )

      if (blocking.length > 0) {
        await openPlanMeal(meal, option)
        return
      }

      const nutrition = calcNutrition(food, option.amountG)

      await addRecord.mutateAsync({
        petId: selectedPet.id,
        foodItemId: food.id,
        foodName: food.name,
        amountG: option.amountG,
        calories: nutrition.calories ?? option.kcal ?? null,
        proteinG: nutrition.proteinG,
        fatG: nutrition.fatG,
        carbG: nutrition.carbG,
        fedAt: getLocalDateTime(),
        mealType: meal.key,
        notes: `依飲食計畫（${meal.label}）`
      })
    } catch (err) {
      console.error('依計畫餵食失敗：', err)

      const message =
        err.response?.data?.error ||
        err.message ||
        '無法建立餵食紀錄'

      setSmartError(message)
      alert(message)
    } finally {
      setFeedingKey('')
    }
  }

  const invalidateFeedingQueries = () => {
    qc.invalidateQueries({ queryKey: ['feeding'] })
    qc.invalidateQueries({ queryKey: ['feeding-stats'] })
    qc.invalidateQueries({ queryKey: ['feeding-alerts'] })
    qc.invalidateQueries({ queryKey: ['feeding-trends'] })
    qc.invalidateQueries({ queryKey: ['meal-plan'] })
  }

  const addRecord = useMutation({
    mutationFn: payload => api.post('/feeding', payload),

    onSuccess: () => {
      invalidateFeedingQueries()

      setShowAddModal(false)
      setEditingRecord(null)

      resetAddForm()
    }
  })

  const updateRecord = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/feeding/${id}`, payload),

    onSuccess: () => {
      invalidateFeedingQueries()

      setShowAddModal(false)
      setEditingRecord(null)

      resetAddForm()
    }
  })

  const deleteRecord = useMutation({
    mutationFn: id => api.delete(`/feeding/${id}`),

    onSuccess: () => {
      invalidateFeedingQueries()
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

      // 編輯紀錄時，若只改餐次、時間、份量或備註，
      // 直接用紀錄當下儲存的營養數值回推，避免重新 AI 分析或清空營養。
      const foodUnchanged = Boolean(
        editingRecord &&
          form.foodName.trim() ===
            String(editingRecord.food_name || '').trim()
      )

      if (!foodForSave && foodUnchanged && amount > 0) {
        const per100 = value =>
          Number.isFinite(Number(value)) && Number(value) > 0
            ? (Number(value) / amount) * 100
            : null

        foodForSave = {
          name: editingRecord.food_name,
          food_name: editingRecord.food_name,
          calories_per_100g: per100(editingRecord.calories),
          protein_pct: per100(editingRecord.protein_g),
          fat_pct: per100(editingRecord.fat_g),
          carb_pct: per100(editingRecord.carb_g)
        }
      }

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
      if (!foodUnchanged && checkedFoodKey !== currentFoodKey) {
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
      if (ackWarnings.length > 0 && !warningAccepted) {
        return
      }

      const nutrition = calcNutrition(
        foodForSave,
        amount
      )

      const payload = {
        petId: selectedPet.id,
        foodItemId: form.foodItemId || null,
        foodName: form.foodName,
        amountG: amount,
        calories: nutrition.calories,
        proteinG: nutrition.proteinG,
        fatG: nutrition.fatG,
        carbG: nutrition.carbG,
        fedAt: form.fedAt,
        mealType: form.mealType,
        notes: form.notes
      }

      if (editingRecord) {
        updateRecord.mutate({
          id: editingRecord.id,
          payload
        })
      } else {
        addRecord.mutate(payload)
      }
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

  // AI 飲食建議：question 有值時是「追加提問」，
  // 後端會沿用同一份寵物資料、當日飲食與健康狀況回答
  const runAdvice = async (question = '') => {
    if (!selectedPet) return

    const isFollowup = Boolean(question)

    if (isFollowup) {
      setSendingQuestion(true)
    } else {
      setLoadingAdvice(true)
      setAdviceError('')
      setDietAdvice('')
      setAdviceSources([])
      setAdviceFollowups([])
    }

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
          recentMeals,
          // 頁面上顯示的那一天的飲食紀錄（含攝取量）
          dayMeals: records.map(mapRecordToMeal),
          dayLabel: formatDate(selectedDate),
          nutritionTarget: selectedTarget,
          dayStatus: selectedStatus,
          question
        }
      )

      if (!data.success) {
        throw new Error(
          data.error || '取得飲食建議失敗'
        )
      }

      if (isFollowup) {
        setAdviceFollowups(prev => [
          ...prev,
          {
            question,
            answer: data.data.advice,
            sources: data.data.sources || []
          }
        ])

        setAdviceQuestion('')
      } else {
        setDietAdvice(data.data.advice)
        setAdviceSources(data.data.sources || [])
      }
    } catch (err) {
      console.error('取得飲食建議失敗：', err)

      setAdviceError(
        err.response?.data?.error ||
          err.message ||
          '無法取得建議，請稍後再試'
      )
    } finally {
      if (isFollowup) {
        setSendingQuestion(false)
      } else {
        setLoadingAdvice(false)
      }
    }
  }

  const getAdvice = () => runAdvice('')

  const askAdvice = () => {
    const question = adviceQuestion.trim()

    if (!question || sendingQuestion || loadingAdvice) {
      return
    }

    runAdvice(question)
  }

  const todayCalories = records.reduce(
    (s, r) =>
      s + Number(r.calories || 0),
    0
  )

  const hasDayData = records.length > 0

  const trendDays = trendData?.days || []

  const trendDay = trendDays.find(day => day.date === selectedDate)

  const planTarget =
    mealPlan?.target?.kcal && Number(mealPlan.target.kcal) > 0
      ? {
          targetKcal: Number(mealPlan.target.kcal),
          minKcal: mealPlan.target.minKcal,
          maxKcal: mealPlan.target.maxKcal,
          basis: mealPlan.target.basis || null,
          formulaVersion: mealPlan.target.formulaVersion || null
        }
      : null

  const trendTarget =
    trendDay?.targetKcal && Number(trendDay.targetKcal) > 0
      ? {
          targetKcal: Number(trendDay.targetKcal),
          minKcal: trendDay.minKcal,
          maxKcal: trendDay.maxKcal,
          basis: trendDay.basis || null,
          formulaVersion: trendDay.formulaVersion || null
        }
      : null

  const selectedTarget =
    selectedDate === today
      ? planTarget || trendTarget
      : trendTarget

  const selectedStatus = !hasDayData
    ? 'no_data'
    : !selectedTarget ||
        !Number.isFinite(Number(selectedTarget.minKcal)) ||
        !Number.isFinite(Number(selectedTarget.maxKcal))
      ? 'no_target'
      : todayCalories < Number(selectedTarget.minKcal)
        ? 'under'
        : todayCalories > Number(selectedTarget.maxKcal)
          ? 'over'
          : 'in_range'

  const STATUS_LABEL = {
    no_data: '這一天尚無餵食紀錄',
    no_target: '資料不足，無法估算建議範圍',
    under: '低於建議範圍',
    in_range: '在建議範圍內',
    over: '超出建議範圍'
  }

  const selectedStatusLabel = STATUS_LABEL[selectedStatus] || ''

  const MEAL_LABEL = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    late: '宵夜',
    snack: '點心'
  }

  const previewNutrition =
    selectedFood && form.amountG
      ? calcNutrition(
          selectedFood,
          Number(form.amountG)
        )
      : null

  const inputCls =
    'w-full rounded-xl border border-sand bg-cream px-3 py-2.5 text-sm text-ink transition-all placeholder:text-ink-soft/60 focus:border-pine-700/40 focus:bg-plate focus:outline-none focus:ring-2 focus:ring-pine-700/35'

  return (
    <div className="flex h-full overflow-hidden">

      {/* 左側：選擇寵物 */}
      <PetDrawer open={petOpen} onClose={() => setPetOpen(false)} widthClass="md:w-52">

        <div className="border-b border-hair px-4 py-5">
          <h2 className="text-sm font-bold text-pine-900">選擇寵物</h2>
          <p className="mt-1 text-xs text-ink-soft">查看飲食紀錄</p>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {pets.map(pet => (
            <button
              key={pet.id}
              onClick={() => {
                setChosenPet(pet)
                setDietAdvice('')
                setAdviceError('')
                setAdviceSources([])
                setAdviceFollowups([])
                setAdviceQuestion('')
                setPetOpen(false)
              }}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                selectedPet?.id === pet.id
                  ? 'border-pine-700/35 bg-pine-50'
                  : 'border-sand bg-cream hover:border-pine-700/30 hover:bg-warm'
              }`}
            >
              <PetIcon species={pet.species} breed={pet.breed} size={40} className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-pine-900">{pet.name}</p>
                <p className="truncate text-xs text-ink-soft">
                  {pet.weight ? `${pet.weight}kg` : pet.species}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="border-t border-hair p-3">
          <Link
            to="/food-database"
            className="group flex w-full items-center gap-3 rounded-2xl border border-hair bg-honey-50 p-3 transition-colors hover:border-pine-700/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-plate">
              <PixelIcon name="dry" size={28} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-pine-900">食物資料庫</span>
              <span className="mt-0.5 block text-[11px] text-ink-soft">查看食物營養資訊</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-pine-700 transition-transform group-hover:translate-x-0.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </PetDrawer>

      {/* 右側主要內容 */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        <PetPickerBar
          icon={selectedPet ? <PetIcon species={selectedPet.species} breed={selectedPet.breed} size={28} className="h-7 w-7 shrink-0" /> : null}
          name={selectedPet?.name}
          sub={selectedPet ? (selectedPet.weight ? `${selectedPet.weight}kg` : selectedPet.species) : ''}
          onOpen={() => setPetOpen(true)}
        />

        {!selectedPet ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState icon="paw" title="請選擇寵物" desc="從左邊清單挑一隻，開始記錄今天的飲食" />
          </div>
        ) : (
          <div className="p-4 sm:p-6 max-w-4xl">

            {/* Header */}
            <PageHeader
              leading={<PetIcon species={selectedPet.species} breed={selectedPet.breed} size={52} className="h-[52px] w-[52px] shrink-0" />}
              title={`${selectedPet.name} 的`}
              accent="飲食管理"
              subtitle="記錄和分析每日餵食狀況"
              actions={
                <>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => goDay(-1)}
                        aria-label="前一天"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-sand bg-plate text-pine-700 transition-colors hover:bg-warm"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15 6l-6 6 6 6" />
                        </svg>
                      </button>

                      <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="rounded-xl border border-sand bg-cream px-3 py-2 text-sm text-ink focus:border-pine-700/40 focus:outline-none"
                      />

                      <button
                        onClick={() => goDay(1)}
                        disabled={selectedDate >= today}
                        aria-label="後一天"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-sand bg-plate text-pine-700 transition-colors hover:bg-warm disabled:opacity-30"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>

                      {selectedDate !== today && (
                        <button
                          onClick={() => setSelectedDate(today)}
                          className="rounded-full bg-warm px-2.5 py-1 text-xs font-bold text-pine-700 transition-colors hover:bg-honey-150"
                        >
                          今天
                        </button>
                      )}
                    </div>

                    <button
                      onClick={openAddModal}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-honey px-4 py-2.5 text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      新增餵食
                    </button>
                </>
              }
            />

            {/* 分頁：今天／趨勢／AI 建議 */}
            <div className="mb-5 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-hair bg-plate p-1 shadow-card">
              {[
                { key: 'today', label: '今天', count: healthAlertCount },
                { key: 'trends', label: '趨勢' },
                { key: 'advice', label: 'AI 建議' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                    activeTab === tab.key
                      ? 'bg-pine-800 text-warm shadow-sm'
                      : 'text-ink-soft hover:bg-plate hover:text-pine-900'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      activeTab === tab.key
                        ? 'bg-lime text-pine-900'
                        : 'bg-honey-100 text-honey-text'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'today' && (
              <DietTodayTab
                dateLabel={formatDate(selectedDate)}
                selectedDate={selectedDate}
                today={today}
                plan={mealPlan}
                planLoading={planLoading}
                planError={planError}
                refetchPlan={refetchPlan}
                target={selectedTarget}
                actualKcal={todayCalories}
                hasData={hasDayData}
                status={selectedStatus}
                records={records}
                activeHealthEvents={activeHealthEvents}
                pastHealthEvents={pastHealthEvents}
                showPastHealthEvents={showPastHealthEvents}
                onTogglePastHealthEvents={() =>
                  setShowPastHealthEvents(value => !value)
                }
                dietAlerts={dietAlerts}
                onFeedMeal={feedFromPlan}
                onAdjustMeal={openPlanMeal}
                onOpenManual={openAddModal}
                onEditPreferences={() => setShowPrefs(true)}
                feedingKey={feedingKey}
                onOpenAdd={openAddModal}
                onEditRecord={openEditModal}
                onDeleteRecord={id => deleteRecord.mutate(id)}
              />
            )}

            {activeTab === 'trends' && (
              <DietTrendTab
                days={trendDays}
                isLoading={trendLoading}
                isError={trendError}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                rangeRule={trendData?.rangeRule}
              />
            )}

            {activeTab === 'advice' && (
              <DietAdviceTab
                pet={selectedPet}
                dateLabel={formatDate(selectedDate)}
                target={selectedTarget}
                actualKcal={todayCalories}
                hasData={hasDayData}
                statusLabel={selectedStatusLabel}
                dietAdvice={dietAdvice}
                loadingAdvice={loadingAdvice}
                adviceError={adviceError}
                adviceSources={adviceSources}
                adviceQuestion={adviceQuestion}
                setAdviceQuestion={setAdviceQuestion}
                adviceFollowups={adviceFollowups}
                sendingQuestion={sendingQuestion}
                onAnalyze={getAdvice}
                onAsk={askAdvice}
                consultationsCount={consultations.length}
              />
            )}

          </div>
        )}

      </div>

      {/* 飲食偏好 */}
      {showPrefs && selectedPet && (
        <DietPreferencesModal
          pet={selectedPet}
          onClose={() => setShowPrefs(false)}
        />
      )}

      {/* 新增餵食 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-900/35 p-4 backdrop-blur-sm">

          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-hair bg-plate shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)]">

            <div className="p-6">

              {/* Modal Header */}
              <div className="flex items-center justify-between mb-5">

                <div>
                  <h2 className="font-brand text-lg font-extrabold text-pine-900">
                    {editingRecord ? (
                      <>編輯<span className="hl">餵食</span>紀錄</>
                    ) : (
                      <>新增<span className="hl">餵食</span>紀錄</>
                    )}
                  </h2>

                  <p className="text-xs text-ink-faint mt-1">
                    {editingRecord
                      ? '修改後會更新同一筆紀錄，不會重複新增'
                      : '可以使用圖片辨識或手動輸入'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetAddForm()
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink-mute transition-colors hover:bg-sand"
                  aria-label="關閉"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>

              </div>

              {/* 智慧推薦 */}
              <div className="mb-5">
                {smartLoading && (
                  <div className="flex items-start gap-2.5">
                    <PixelAssistant tile size={34} mood="typing" />
                    <div className="bubble-ai min-w-0 flex-1 px-4 py-3">
                      <p className="text-sm font-bold text-pine-900">正在分析最近飲食…</p>
                      <p className="mt-1 text-xs text-ink-soft">系統會參考近期餵食、熱量與健康紀錄</p>
                    </div>
                  </div>
                )}

                {smartError && !smartLoading && (
                  <div className="rounded-2xl border-2 border-clay bg-clay-50 p-3">
                    <p className="text-xs text-clay">
                      {smartError}
                    </p>
                  </div>
                )}

                {smartDiet?.recommendation && !smartLoading && (
                  <div className="flex items-start gap-2.5">
                      <PixelAssistant tile size={36} />

                      <div className="bubble-ai min-w-0 flex-1 p-3.5">
                        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-honey-deep">系統推薦</p>

                        <p className="mt-1 text-sm font-bold text-pine-900">
                          {smartDiet.recommendation.title}
                        </p>

                        <p className="mt-1.5 text-sm leading-relaxed text-ink">
                          {smartDiet.recommendation.recommendation}
                        </p>

                        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                          原因：{smartDiet.recommendation.reason}
                        </p>

                        {smartDiet.history?.hasData && (
                          <p className="mt-3 text-xs font-medium text-ink-soft">
                            已分析 {smartDiet.history.mealCount} 筆近期餵食紀錄
                          </p>
                        )}
                      </div>
                    </div>
                )}
              </div>

              {/* 模式切換 */}
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-hair bg-cream p-1">

                <button
                  type="button"
                  onClick={() => {
                    setInputMode('image')
                    setAiError('')
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all ${
                    inputMode === 'image'
                      ? 'bg-pine-800 text-warm shadow-sm'
                      : 'text-ink-mute hover:text-ink-body'
                  }`}
                >
                  <PixelIcon name="camera" size={18} />
                  圖片辨識
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInputMode('manual')
                    setAiError('')
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all ${
                    inputMode === 'manual'
                      ? 'bg-pine-800 text-warm shadow-sm'
                      : 'text-ink-mute hover:text-ink-body'
                  }`}
                >
                  <PixelIcon name="note" size={18} />
                  手動輸入
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
                        className="w-full rounded-2xl border-2 border-dashed border-hair-strong bg-cream p-8 transition-all hover:border-pine-200 hover:bg-pine-50"
                      >
                        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-hair bg-plate shadow-card">
                          <PixelIcon name="camera" size={38} />
                        </span>

                        <p className="text-sm font-semibold text-ink-body">
                          上傳食物圖片
                        </p>

                        <p className="text-xs text-ink-faint mt-1">
                          JPG、PNG，最大 10MB
                        </p>

                      </button>
                    ) : (
                      <div className="relative">

                        <img
                          src={imagePreview}
                          alt="食物預覽"
                          className="h-48 w-full rounded-2xl border border-hair object-cover"
                        />

                        <button
                          type="button"
                          onClick={clearImage}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-pine-900/70 text-white transition-colors hover:bg-pine-900"
                          aria-label="移除圖片"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
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
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-pine-800 py-3 font-brand text-sm font-extrabold text-warm transition-colors hover:bg-pine-700 disabled:opacity-60"
                      >
                        <PixelAssistant size={22} mood={aiAnalyzing ? 'typing' : 'idle'} />
                        {aiAnalyzing ? 'AI 正在辨識食物…' : '開始辨識食物與營養'}
                      </button>
                    )}

                    {aiError && (
                      <div className="rounded-2xl border-2 border-clay bg-clay-50 p-3">
                        <p className="text-xs text-clay">
                          {aiError}
                        </p>
                      </div>
                    )}

                    {aiResult && (
                      <div className="rounded-2xl border border-hair bg-cream p-4">

                        <div className="flex items-center justify-between mb-3">

                          <div>
                            <p className="flex items-center gap-1.5 text-xs font-bold text-pine-800">
                              <PixelAssistant size={20} />
                              AI 辨識結果
                            </p>

                            {aiResult.confidence != null && (
                              <p className="text-xs text-pine-600 mt-0.5">
                                信心度：
                                {Math.round(
                                  Number(
                                    aiResult.confidence
                                  ) * 100
                                )}%
                              </p>
                            )}

                          </div>

                          <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-bold text-pine-900">
                            可修改
                          </span>

                        </div>

                        <div className="grid grid-cols-2 gap-2">

                          <div className="col-span-2 rounded-xl border border-hair bg-plate p-2.5">

                            <p className="text-xs text-ink-faint">
                              食物
                            </p>

                            <p className="text-sm font-bold text-ink-body">
                              {aiResult.foodName || '未知'}
                            </p>

                          </div>

                          <div className="rounded-xl border border-hair bg-plate p-2.5">

                            <p className="text-xs text-ink-faint">
                              估計份量
                            </p>

                            <p className="text-sm font-bold text-ink-body">
                              {aiResult.estimatedAmountG != null
                                ? `${aiResult.estimatedAmountG} g`
                                : '未估計'}
                            </p>

                          </div>

                          <div className="rounded-xl border border-hair bg-plate p-2.5">

                            <p className="text-xs text-ink-faint">
                              熱量
                            </p>

                            <p className="text-sm font-bold text-pine-700">
                              {aiResult.calories != null
                                ? `${aiResult.calories} kcal`
                                : '—'}
                            </p>

                          </div>

                        </div>

                        {aiResult.note && (
                          <p className="text-xs text-pine-700 mt-3">
                            {aiResult.note}
                          </p>
                        )}

                      </div>
                    )}

                    {/* AI 結果可以繼續修改 */}
                    {aiResult && (
                      <div className="space-y-3">

                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-ink-mute">
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
                          <label className="mb-1.5 block text-xs font-bold text-ink-mute">
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

                          <p className="text-xs text-ink-faint mt-1">
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
                      <label className="mb-1.5 block text-xs font-bold text-ink-mute">
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

                      <label className="mb-1.5 block text-xs font-bold text-ink-mute">
                        食物名稱 *
                        <span className="ml-1 text-ink-ghost font-normal">
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
                              className="shrink-0 bg-pine-50 hover:bg-pine-100 text-pine-700 border border-pine-100 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {aiAnalyzing
                                ? '...'
                                : 'AI 估算'}
                            </button>
                          )}

                      </div>

                    </div>

                  </>
                )}

                {/* 餵食前檢查流程：健康歷史 → 近期飲食 → 營養與安全 → 確認 */}
                <FoodCheckSteps
                  warnings={foodWarnings}
                  checking={checkingFood}
                  checked={!!checkedFoodKey}
                />

                {/* 飲食警訊 */}
                {checkingFood && (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-hair bg-cream p-3">
                    <PixelAssistant size={26} mood="typing" />
                    <p className="text-xs font-bold text-ink-mute">正在檢查這個食物是否適合目前狀況…</p>
                  </div>
                )}

                {ackWarnings.length > 0 && !checkingFood && (
                  <div className="rounded-2xl border-2 border-honey-300 bg-honey-50 p-4">
                    <div className="flex items-start gap-2.5">
                      <AlertIcon size={22} className="mt-0.5 text-honey-600" />

                      <div className="flex-1">
                        <p className="text-sm font-bold text-honey-brown">
                          飲食警訊
                        </p>

                        <div className="space-y-3 mt-2">
                          {ackWarnings.map((warning, index) => (
                            <div
                              key={`${warning.title}-${index}`}
                              className="rounded-xl bg-plate/80 p-3"
                            >
                              <p className="text-xs font-bold text-pine-900">
                                {warning.title}
                              </p>

                              <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                                {warning.reason}
                              </p>

                              {warning.suggestion && (
                                <p className="text-xs text-honey-text mt-1.5 leading-relaxed">
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
                              className="rounded-xl border border-honey-300 bg-plate py-2.5 text-xs font-bold text-honey-text hover:bg-honey-50"
                            >
                              修改食物
                            </button>

                            <button
                              type="button"
                              onClick={() => setWarningAccepted(true)}
                              className="rounded-xl bg-honey py-2.5 text-xs font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none"
                            >
                              仍要儲存
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-lime bg-lime/30 px-3 py-2">
                            <p className="flex items-center gap-1.5 text-xs font-bold text-pine-900">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12.5l4.5 4.5L19 7.5" />
                              </svg>
                              已確認警訊，可繼續儲存此紀錄
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 健康提醒：只是提醒，不阻擋新增 */}
                {advisoryWarnings.length > 0 && !checkingFood && (
                  <div className="rounded-2xl border border-honey-150 bg-honey-50/60 p-4">
                    <div className="flex items-start gap-2.5">
                      <AlertIcon size={22} className="mt-0.5 text-honey-600" />

                      <div className="flex-1">
                        <p className="text-sm font-bold text-honey-brown">
                          健康提醒
                        </p>

                        <div className="space-y-2 mt-2">
                          {advisoryWarnings.map((warning, index) => (
                            <div
                              key={`${warning.title}-${index}`}
                              className="rounded-xl bg-plate/80 p-3"
                            >
                              <p className="text-xs font-bold text-pine-900">
                                {warning.title}
                              </p>

                              <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                                {warning.reason}
                              </p>

                              {warning.suggestion && (
                                <p className="text-xs text-honey-text mt-1.5 leading-relaxed">
                                  建議：{warning.suggestion}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-honey-text/80 mt-2">
                          這只是提醒，仍可正常新增餵食紀錄。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 份量與時間 */}
                <div className="grid grid-cols-2 gap-3">

                  <div>

                    <label className="mb-1.5 block text-xs font-bold text-ink-mute">
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

                    <label className="mb-1.5 block text-xs font-bold text-ink-mute">
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

                {/* 餐次 */}
                <div>

                  <label className="mb-1.5 block text-xs font-bold text-ink-mute">
                    餐次
                  </label>

                  <select
                    value={form.mealType}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        mealType: e.target.value
                      }))
                    }
                    className={inputCls}
                  >
                    {Object.entries(MEAL_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}

                    {form.mealType && !MEAL_LABEL[form.mealType] && (
                      <option value={form.mealType}>自訂餐次</option>
                    )}
                  </select>

                </div>

                {/* 營養結果 */}
                {previewNutrition?.calories != null && (
                  <div className="rounded-2xl bg-pine-800 px-4 py-3.5 text-paper">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-lime">
                        {aiResult ? 'AI 估算這餐熱量' : '這餐熱量'}
                      </p>
                      {aiResult && <span className="text-xs text-paper/60">圖片估算</span>}
                    </div>
                    <p className="mt-1.5 font-brand text-3xl font-extrabold leading-none tabular-nums text-paper">
                      <span className="text-base font-bold text-paper/70">約 </span>
                      {previewNutrition.calories}
                      <span className="ml-1 font-mono text-sm font-bold text-lime">kcal</span>
                    </p>
                  </div>
                )}

                {/* 備註 */}
                <div>

                  <label className="mb-1.5 block text-xs font-bold text-ink-mute">
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
                    className="flex-1 rounded-xl border border-hair-strong bg-plate py-3 text-sm font-bold text-ink-soft transition-colors hover:bg-cream"
                  >
                    取消
                  </button>

                  <button
                    type="submit"
                    disabled={
                      addRecord.isPending ||
                      updateRecord.isPending ||
                      aiAnalyzing ||
                      checkingFood ||
                      !form.foodName ||
                      !form.amountG ||
                      (ackWarnings.length > 0 && !warningAccepted)
                    }
                    className="flex-1 rounded-xl bg-honey py-3 font-brand text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
                  >
                    {addRecord.isPending || updateRecord.isPending
                      ? editingRecord
                        ? '儲存中...'
                        : '新增中...'
                      : checkingFood
                      ? '檢查中...'
                      : warningAccepted
                      ? '確認儲存'
                      : editingRecord
                      ? '儲存修改'
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