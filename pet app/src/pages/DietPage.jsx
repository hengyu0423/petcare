import { useState, useEffect, useRef } from 'react'
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
  Dog,
  Cat,
  Bird,
  Rabbit,
  Fish,
  PawPrint,
  Utensils,
  AlertTriangle,
  ClipboardList,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Search,
  Database,
  Camera,
  Edit3,
  Trash2,
  HeartPulse,
  Info,
  Check,
  CheckCircle2,
  Lightbulb,
  Package
} from 'lucide-react'
import { api } from '../lib/api'
import { PetDrawer, PetPickerBar } from '../components/layout/PetDrawer'
import MealPlanSection from '../components/diet/MealPlanSection'
import DietPreferencesModal from '../components/diet/DietPreferencesModal'
import FoodCheckSteps from '../components/diet/FoodCheckSteps'

const SPECIES_ICONS = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  fish: Fish,
  other: PawPrint
}

// 健康事件嚴重程度（與健康諮詢頁一致）
const HEALTH_SEVERITY = {
  normal: {
    label: '一般注意',
    className: 'bg-[var(--ef-chip)] text-[var(--ef-ink)] border-[var(--ef-rule)]'
  },
  urgent: {
    label: '儘速就醫',
    className: 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] border-[var(--ef-ink)] font-bold'
  },
  emergency: {
    label: '緊急警訊',
    className: 'bg-[var(--ef-ink)] text-[var(--ef-signal)] border-[var(--ef-ink)] font-bold'
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
  const [petOpen, setPetOpen] = useState(false) // 手機寵物抽屜
  const [showPastHealthEvents, setShowPastHealthEvents] = useState(false) // 展開已過注意期的健康事件
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

  // 飼主的飲食偏好視窗
  const [showPrefs, setShowPrefs] = useState(false)

  // 頁面分頁：today｜alerts｜records｜advice
  const [activeTab, setActiveTab] = useState('today')

  // 需要使用者按「仍要儲存」確認的警訊（維持原本的行為），
  // 以及只是提醒、不阻擋操作的警訊（例如健康歷史提醒）
  const ackWarnings = foodWarnings.filter(w => w.requireAck !== false)
  const advisoryWarnings = foodWarnings.filter(w => w.requireAck === false)

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
  const visibleHealthEvents = showPastHealthEvents
    ? [...activeHealthEvents, ...pastHealthEvents]
    : activeHealthEvents

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
      notes: `依飲食計畫（${meal.label}）`
    }))

    await checkFoodSafety({
      ...food,
      food_name: food.name
    })
  }

  const addRecord = useMutation({
    mutationFn: payload => api.post('/feeding', payload),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feeding'] })
      qc.invalidateQueries({ queryKey: ['feeding-stats'] })
      qc.invalidateQueries({ queryKey: ['feeding-alerts'] })
      qc.invalidateQueries({ queryKey: ['meal-plan'] })

      setShowAddModal(false)

      resetAddForm()
    }
  })

  const deleteRecord = useMutation({
    mutationFn: id => api.delete(`/feeding/${id}`),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feeding'] })
      qc.invalidateQueries({ queryKey: ['feeding-stats'] })
      qc.invalidateQueries({ queryKey: ['feeding-alerts'] })
      qc.invalidateQueries({ queryKey: ['meal-plan'] })
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
      if (ackWarnings.length > 0 && !warningAccepted) {
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
    'w-full bg-[var(--ef-panel)] border border-[var(--ef-rule)] px-3 py-2 text-xs text-[var(--ef-ink)] font-mono focus:border-[var(--ef-ink)] focus:outline-hidden transition-colors'

  return (
    <div className="ef pc-home flex h-full overflow-hidden bg-[var(--ef-paper)] text-[var(--ef-ink)]">

      {/* 左側：選擇寵物 (Endfield Pet Drawer) */}
      <PetDrawer open={petOpen} onClose={() => setPetOpen(false)} widthClass="md:w-60">

        <div className="px-4 py-3.5 border-b border-[var(--ef-rule)] bg-[var(--ef-paper)]">
          <h2 className="text-xs font-bold text-[var(--ef-ink)] uppercase tracking-wider font-mono">
            // SELECT PET // 選擇寵物
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">

          {pets.map(pet => {
            const Icon = SPECIES_ICONS[pet.species] || PawPrint
            const active = selectedPet?.id === pet.id
            return (
              <button
                key={pet.id}
                onClick={() => {
                  setSelectedPet(pet)
                  setDietAdvice('')
                  setAdviceError('')
                  setPetOpen(false)
                }}
                className={`w-full flex items-center gap-2.5 p-2.5 border text-left transition-colors ${
                  active
                    ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] border-[var(--ef-ink)] font-bold'
                    : 'bg-[var(--ef-panel)] border-[var(--ef-rule)] hover:border-[var(--ef-ink)] text-[var(--ef-ink)]'
                }`}
                style={{
                  clipPath: active ? 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' : 'none'
                }}
              >
                <div
                  className={`w-8 h-8 flex items-center justify-center shrink-0 ${
                    active
                      ? 'bg-[var(--ef-ink)] text-[var(--ef-signal)]'
                      : 'bg-[var(--ef-paper)] text-[var(--ef-ink)] border border-[var(--ef-rule)]'
                  }`}
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)'
                  }}
                >
                  <Icon size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{pet.name}</p>
                  <p className={`text-[10px] font-mono truncate ${active ? 'text-[var(--ef-on-signal)]/80' : 'text-[var(--ef-ink-2)]'}`}>
                    {pet.weight ? `${pet.weight}kg` : pet.species}
                  </p>
                </div>
              </button>
            )
          })}

        </div>

        <div className="p-2.5 border-t border-[var(--ef-rule)]">
          <Link
            to="/food-database"
            className="group block w-full border border-[var(--ef-rule)] bg-[var(--ef-panel)] p-2.5 hover:border-[var(--ef-ink)] transition-colors"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)'
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 bg-[var(--ef-ink)] text-[var(--ef-signal)] flex items-center justify-center shrink-0"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)'
                }}
              >
                <Database size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--ef-ink)]">
                  食物資料庫
                </p>
                <p className="text-[10px] font-mono text-[var(--ef-ink-2)] mt-0.5">
                  熱量與營養素庫 →
                </p>
              </div>
            </div>
          </Link>
        </div>
      </PetDrawer>

      {/* 右側主要內容 */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        <PetPickerBar
          name={selectedPet?.name}
          sub={selectedPet ? (selectedPet.weight ? `${selectedPet.weight}kg` : selectedPet.species) : ''}
          onOpen={() => setPetOpen(true)}
        />

        {!selectedPet ? (
          <div className="flex items-center justify-center h-full flex-col gap-3 text-center p-8">
            <div className="w-12 h-12 bg-[var(--ef-ink)] text-[var(--ef-signal)] flex items-center justify-center"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
            >
              <Utensils size={24} strokeWidth={2} />
            </div>
            <p className="font-bold text-sm text-[var(--ef-ink)]">請先由左側選擇寵物</p>
            <p className="text-xs font-mono text-[var(--ef-ink-2)]">管理與追蹤每日各餐攝取與安全建議</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--ef-rule)] pb-4">

              <div>
                <span className="ef-eyebrow slash">PawCare / Nutrition</span>
                <h1 className="text-2xl font-black text-[var(--ef-ink)] tracking-tight mt-0.5">
                  {selectedPet.name} 的飲食管理
                </h1>
                <p className="text-xs font-mono text-[var(--ef-ink-2)] mt-1">
                  // NUTRITION & FEEDING PIPELINE
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">

                <div className="flex items-center gap-1">

                  <button
                    onClick={() => goDay(-1)}
                    className="ef-btn small p-1 w-8 h-8 flex items-center justify-center"
                    aria-label="前一天"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <div className="border border-[var(--ef-rule)] bg-[var(--ef-panel)] px-2.5 py-1.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-[var(--ef-ink-2)]" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="bg-transparent text-xs font-mono text-[var(--ef-ink)] focus:outline-hidden"
                    />
                  </div>

                  <button
                    onClick={() => goDay(1)}
                    disabled={selectedDate >= today}
                    className="ef-btn small p-1 w-8 h-8 flex items-center justify-center"
                    aria-label="後一天"
                  >
                    <ChevronRight size={15} />
                  </button>

                  {selectedDate !== today && (
                    <button
                      onClick={() => setSelectedDate(today)}
                      className="ef-btn small px-2 py-1 text-[11px] font-mono font-bold"
                    >
                      TODAY
                    </button>
                  )}

                </div>

                <button
                  type="button"
                  onClick={openAddModal}
                  className="ef-btn small go flex items-center gap-1.5"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>新增餵食紀錄</span>
                </button>

              </div>
            </div>

            {/* 分頁標籤：今日指引／健康提醒／給食紀錄／營養建議 */}
            <div className="flex items-center gap-1.5 border-b border-[var(--ef-rule)] pb-2 overflow-x-auto overflow-y-hidden" aria-label="功能分頁">
              {[
                { key: 'today',   label: '今日指引', icon: Utensils },
                {
                  key: 'alerts',
                  label: '健康提醒',
                  icon: AlertTriangle,
                  count: healthAlertCount
                },
                { key: 'records', label: '給食紀錄', icon: ClipboardList },
                { key: 'advice',  label: '營養建議', icon: Sparkles }
              ].map(tab => {
                const Icon = tab.icon
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors ${
                      active
                        ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] border border-[var(--ef-ink)] font-bold'
                        : 'bg-[var(--ef-panel)] border border-[var(--ef-rule)] text-[var(--ef-ink-2)] hover:border-[var(--ef-ink)] hover:text-[var(--ef-ink)]'
                    }`}
                    style={{
                      clipPath: active ? 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)' : 'none'
                    }}
                  >
                    <Icon size={12} />
                    <span>{tab.label}</span>

                    {tab.count > 0 && (
                      <span className="min-w-[15px] h-[15px] px-1 bg-[var(--ef-ink)] text-[var(--ef-signal)] text-[9px] font-bold font-mono flex items-center justify-center">
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {activeTab === 'today' && (
              <div className="mt-4">
                <MealPlanSection
                  key={selectedPet.id}
                  pet={selectedPet}
                  onUseMeal={openPlanMeal}
                  onOpenManual={openAddModal}
                  onEditPreferences={() => setShowPrefs(true)}
                />
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="space-y-4 mt-4">
                {/* 近期健康事件與飲食注意 */}
                {dietHealthEvents.length > 0 && (
                  <div className="ef-panel p-5 border border-[var(--ef-rule)] bg-[var(--ef-panel)] relative">
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--ef-rule)] pb-3">
                      <div>
                        <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--ef-ink-2)]">
                          // HEALTH_EVENTS & NUTRITION_CAUTION
                        </div>
                        <h2 className="text-sm font-bold text-[var(--ef-ink)] flex items-center gap-2">
                          <HeartPulse size={15} className="text-[var(--ef-ink)]" />
                          <span>近期健康事件與飲食注意事項</span>
                        </h2>
                      </div>

                      <Link
                        to="/health-consult"
                        className="text-xs font-mono font-bold text-[var(--ef-ink)] hover:underline flex items-center gap-1"
                      >
                        <span>前往健康諮詢</span>
                        <ChevronRight size={13} />
                      </Link>
                    </div>

                    <div className="space-y-3">
                      {visibleHealthEvents.map(event => {
                        const info = event.diet_info || {}
                        const severity = HEALTH_SEVERITY[event.severity]

                        return (
                          <div
                            key={event.id}
                            className={`border p-3.5 ${
                              event.is_active
                                ? 'border-[var(--ef-ink)] bg-[var(--ef-panel)]'
                                : 'border-[var(--ef-rule)] bg-[var(--ef-paper)]/50 opacity-70'
                            }`}
                          >
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-sm font-bold text-[var(--ef-ink)]">
                                {event.title}
                              </span>

                              {severity && (
                                <span
                                  className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${severity.className}`}
                                >
                                  {severity.label}
                                </span>
                              )}

                              <span className="text-xs font-mono text-[var(--ef-ink-2)]">
                                {event.date_str}
                              </span>

                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 border ${
                                  event.is_active
                                    ? 'border-[var(--ef-ink)] bg-[var(--ef-signal)] text-[var(--ef-on-signal)] font-bold'
                                    : 'border-[var(--ef-rule)] bg-[var(--ef-panel)] text-[var(--ef-ink-2)]'
                                }`}
                              >
                                {event.is_active
                                  ? `注意期至 ${event.diet_until_str}`
                                  : '已過注意期'}
                              </span>
                            </div>

                            {event.description && (
                              <p className="text-xs text-[var(--ef-ink-2)] mt-2 leading-relaxed">
                                {event.description}
                              </p>
                            )}

                            {info.dietNotes && (
                              <p className="text-xs font-mono text-[var(--ef-ink)] bg-[var(--ef-paper)] border border-[var(--ef-rule)] p-2 mt-2">
                                // 飲食重點：{info.dietNotes}
                              </p>
                            )}

                            {info.avoidFoods?.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                <span className="text-xs font-mono text-[var(--ef-ink-2)]">
                                  應避免食材:
                                </span>
                                {info.avoidFoods.map(food => (
                                  <span
                                    key={food}
                                    className="text-xs font-mono bg-[var(--ef-paper)] text-[var(--ef-danger)] border border-[var(--ef-danger)] px-2 py-0.5 font-bold"
                                  >
                                    [X] {food}
                                  </span>
                                ))}
                              </div>
                            )}

                            {info.dietAdvice?.length > 0 && (
                              <ul className="mt-2 space-y-1 font-mono text-xs text-[var(--ef-ink-2)]">
                                {info.dietAdvice.map(item => (
                                  <li key={item} className="flex items-start gap-1.5">
                                    <span className="text-[var(--ef-ink-2)]">//</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {activeHealthEvents.length === 0 && (
                      <div className="border border-dashed border-[var(--ef-rule)] bg-[var(--ef-paper)] p-4 text-center text-xs font-mono text-[var(--ef-ink-2)] mt-3">
                        // 目前無注意期內之健康警訊事件
                      </div>
                    )}

                    {pastHealthEvents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPastHealthEvents(v => !v)}
                        className="text-xs font-mono text-[var(--ef-ink-2)] hover:text-[var(--ef-ink)] mt-3 flex items-center gap-1"
                      >
                        <span>{showPastHealthEvents ? '▲ 收合已過注意期紀錄' : `▼ 展開已過注意期紀錄 (${pastHealthEvents.length})`}</span>
                      </button>
                    )}

                    <p className="text-[10px] font-mono text-[var(--ef-ink-2)] mt-3 border-t border-[var(--ef-rule)] pt-2">
                      // 系統建議僅供日常飼育參考，非臨床醫療診斷。智慧推薦與食材檢查流程將自動參照以上數據。
                    </p>
                  </div>
                )}

                {/* 飲食異常警訊 */}
                {dietAlerts?.alerts?.length > 0 && (
                  <div className="ef-panel p-5 border border-[var(--ef-rule)] bg-[var(--ef-panel)] relative">
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--ef-rule)] pb-3">
                      <div>
                        <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--ef-ink-2)]">
                          // DIETARY_ANOMALY_ALERTS
                        </div>
                        <h2 className="text-sm font-bold text-[var(--ef-ink)] flex items-center gap-2">
                          <AlertTriangle size={15} className="text-[var(--ef-ink)]" />
                          <span>飲食狀況提醒與警訊</span>
                        </h2>
                      </div>

                      {dietAlerts.basis?.enough && (
                        <span className="text-xs font-mono text-[var(--ef-ink-2)]">
                          近 {dietAlerts.basis.windowDays} 天 ({dietAlerts.basis.records} 筆紀錄分析)
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {dietAlerts.alerts.map(alert => (
                        <div
                          key={alert.id}
                          className="border border-[var(--ef-rule)] border-l-2 border-l-[var(--ef-signal)] bg-[var(--ef-panel)] p-3.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-[var(--ef-signal)] border border-[var(--ef-ink)] shrink-0" />
                            <p className="text-sm font-bold text-[var(--ef-ink)]">
                              {alert.title}
                            </p>
                          </div>

                          <p className="text-xs text-[var(--ef-ink-2)] mt-1.5 leading-relaxed">
                            {alert.message}
                          </p>

                          {alert.suggestion && (
                            <p className="text-xs font-mono text-[var(--ef-ink)] bg-[var(--ef-paper)] border-l-2 border-[var(--ef-signal)] pl-2 py-1 mt-2 leading-relaxed">
                              // 改善建議：{alert.suggestion}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {dietAlerts.basis?.skipped?.length > 0 && (
                      <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-3">
                        {dietAlerts.basis.skipped.join(' // ')}
                      </p>
                    )}

                    <p className="text-[10px] font-mono text-[var(--ef-ink-2)] mt-3 border-t border-[var(--ef-rule)] pt-2">
                      // 以上為依近期餵食數據推算之趨勢分析與建議，若有疑慮請諮詢專業獸醫師。
                    </p>
                  </div>
                )}

                {dietHealthEvents.length === 0 && (!dietAlerts?.alerts || dietAlerts.alerts.length === 0) && (
                  <div className="ef-panel p-8 text-center border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
                    <CheckCircle2 size={28} className="mx-auto mb-2 text-[var(--ef-ink)]" />
                    <p className="text-sm font-bold text-[var(--ef-ink)]">目前無任何異常提醒</p>
                    <p className="text-xs font-mono text-[var(--ef-ink-2)] mt-1">
                      // 毛孩飲食攝取正常且近期無特殊健康事件，請繼續保持！
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'records' && (
              <div className="space-y-4 mt-4">
                {/* 統計卡片 (Endfield Panels with Large Figures) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="ef-panel p-4 border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
                    <div className="text-[10px] font-mono text-[var(--ef-ink-2)]">// CALORIES</div>
                    <p className="text-xs font-bold text-[var(--ef-ink)] mt-0.5">{formatDate(selectedDate)} 熱量</p>
                    <p className="text-2xl font-black font-mono text-[var(--ef-ink)] mt-1">
                      {todayCalories.toFixed(0)}
                      <span className="text-xs font-normal text-[var(--ef-ink-2)] ml-1">KCAL</span>
                    </p>
                    {recommended && (
                      <div className="mt-2 pt-2 border-t border-[var(--ef-rule)]">
                        <div className="flex justify-between text-[11px] font-mono text-[var(--ef-ink-2)] mb-1">
                          <span>建議 {recommended} kcal</span>
                          <span className="font-bold text-[var(--ef-ink)]">{caloriePct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-[var(--ef-chip)] overflow-hidden border border-[var(--ef-rule)]">
                          <div
                            className="h-full bg-[var(--ef-signal)] transition-all"
                            style={{
                              width: `${Math.min(caloriePct, 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ef-panel p-4 border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
                    <div className="text-[10px] font-mono text-[var(--ef-ink-2)]">// PROTEIN</div>
                    <p className="text-xs font-bold text-[var(--ef-ink)] mt-0.5">蛋白質</p>
                    <p className="text-2xl font-black font-mono text-[var(--ef-ink)] mt-1">
                      {todayProtein.toFixed(1)}
                      <span className="text-xs font-normal text-[var(--ef-ink-2)] ml-1">G</span>
                    </p>
                    <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-2 pt-2 border-t border-[var(--ef-rule)]">
                      總量佔比指標
                    </p>
                  </div>

                  <div className="ef-panel p-4 border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
                    <div className="text-[10px] font-mono text-[var(--ef-ink-2)]">// FAT</div>
                    <p className="text-xs font-bold text-[var(--ef-ink)] mt-0.5">脂肪</p>
                    <p className="text-2xl font-black font-mono text-[var(--ef-ink)] mt-1">
                      {todayFat.toFixed(1)}
                      <span className="text-xs font-normal text-[var(--ef-ink-2)] ml-1">G</span>
                    </p>
                    <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-2 pt-2 border-t border-[var(--ef-rule)]">
                      脂質攝取估算
                    </p>
                  </div>

                  <div className="ef-panel p-4 border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
                    <div className="text-[10px] font-mono text-[var(--ef-ink-2)]">// MEAL_COUNT</div>
                    <p className="text-xs font-bold text-[var(--ef-ink)] mt-0.5">餵食次數</p>
                    <p className="text-2xl font-black font-mono text-[var(--ef-ink)] mt-1">
                      {records.length}
                      <span className="text-xs font-normal text-[var(--ef-ink-2)] ml-1">MEALS</span>
                    </p>
                    <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-2 pt-2 border-t border-[var(--ef-rule)]">
                      今日餐次總結
                    </p>
                  </div>
                </div>

                {/* 餵食紀錄清單 (Endfield Records) */}
                <div className="ef-panel border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
                  <div className="px-5 py-3.5 border-b border-[var(--ef-rule)] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--ef-ink-2)]">
                        // FEEDING_RECORDS
                      </div>
                      <h2 className="text-sm font-bold text-[var(--ef-ink)]">
                        {formatDate(selectedDate)} 餵食紀錄清單
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={openAddModal}
                      className="ef-btn small go flex items-center gap-1 font-mono text-xs"
                    >
                      <Plus size={13} strokeWidth={2.5} />
                      <span>登記給食</span>
                    </button>
                  </div>

                  {records.length === 0 ? (
                    <div className="py-12 text-center p-6">
                      <div className="w-10 h-10 mx-auto mb-2 bg-[var(--ef-paper)] border border-[var(--ef-rule)] flex items-center justify-center text-[var(--ef-ink-2)]">
                        <Utensils size={20} strokeWidth={1.8} />
                      </div>
                      <p className="text-xs font-mono text-[var(--ef-ink-2)] mb-3">
                        // 這天尚無給食紀錄
                      </p>
                      {selectedDate === today && (
                        <button
                          type="button"
                          onClick={openAddModal}
                          className="ef-btn small go"
                        >
                          + 登記第一筆給食紀錄
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--ef-rule)]">
                      {records.map(record => (
                        <div
                          key={record.id}
                          className="flex items-center gap-3.5 px-5 py-3 hover:bg-[var(--ef-paper)] transition-colors group"
                        >
                          <div className="w-9 h-9 bg-[var(--ef-ink)] text-[var(--ef-panel)] flex items-center justify-center shrink-0"
                            style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}
                          >
                            {record.food_name?.includes('乾') ? (
                              <Utensils size={15} className="text-[var(--ef-signal)]" />
                            ) : record.food_name?.includes('罐') || record.food_name?.includes('濕') ? (
                              <Package size={15} className="text-[var(--ef-signal)]" />
                            ) : (
                              <Utensils size={15} className="text-[var(--ef-signal)]" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[var(--ef-ink)] truncate">
                              {record.food_name}
                            </p>

                            <p className="text-xs font-mono text-[var(--ef-ink-2)] mt-0.5">
                              <span>{record.amount_g}g</span>
                              {record.calories && (
                                <span> │ {Number(record.calories).toFixed(0)} kcal</span>
                              )}
                              {record.protein_g && (
                                <span> │ 蛋白 {Number(record.protein_g).toFixed(1)}g</span>
                              )}
                              <span>
                                {' │ '}
                                {new Date(record.fed_at).toLocaleTimeString('zh-TW', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </p>

                            {record.notes && (
                              <p className="text-xs text-[var(--ef-ink-2)] mt-1 bg-[var(--ef-paper)] border-l border-[var(--ef-ink)] pl-1.5 py-0.5">
                                備註：{record.notes}
                              </p>
                            )}
                          </div>

                          {record.calories && (
                            <div className="text-right shrink-0">
                              <span className="font-mono text-xs font-bold text-[var(--ef-ink)] bg-[var(--ef-paper)] border border-[var(--ef-rule)] px-2 py-1">
                                {Number(record.calories).toFixed(0)} KCAL
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('確定刪除此筆餵食紀錄？此動作無法復原。')) {
                                deleteRecord.mutate(record.id)
                              }
                            }}
                            className="ef-btn small danger p-1 text-xs shrink-0"
                            aria-label="刪除"
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 近期熱量趨勢 */}
                {dailyStats.length > 0 && (
                  <div className="ef-panel p-5 border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--ef-rule)] pb-2">
                      <div>
                        <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--ef-ink-2)]">
                          // 7_DAYS_CALORIE_TRENDS
                        </div>
                        <h2 className="text-sm font-bold text-[var(--ef-ink)]">近期熱量攝取趨勢</h2>
                      </div>
                      {recommended && (
                        <span className="text-xs font-mono text-[var(--ef-ink-2)]">
                          基準值: {recommended} kcal/day
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        height: '140px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '10px'
                      }}
                    >
                      {dailyStats
                        .slice(0, 7)
                        .reverse()
                        .map((stat, i) => {
                          const max = Math.max(
                            ...dailyStats.slice(0, 7).map(s => Number(s.total_calories || 0)),
                            recommended || 0
                          )
                          const cal = Number(stat.total_calories || 0)
                          const barHeight = max > 0 ? Math.max((cal / max) * 100, 8) : 8

                          const dateStr = (() => {
                            const value = String(stat.date)
                            if (value.includes('T') && value.endsWith('Z')) {
                              const d = new Date(value)
                              return (
                                `${d.getFullYear()}-` +
                                `${String(d.getMonth() + 1).padStart(2, '0')}-` +
                                `${String(d.getDate()).padStart(2, '0')}`
                              )
                            }
                            return value.slice(0, 10)
                          })()

                          const isSelected = dateStr === selectedDate

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
                              onClick={() => setSelectedDate(dateStr)}
                            >
                              <span className="text-[10px] font-mono text-[var(--ef-ink-2)] h-4 leading-4">
                                {cal > 0 ? cal.toFixed(0) : ''}
                              </span>

                              <div
                                className={`w-full transition-colors border ${
                                  isSelected
                                    ? 'bg-[var(--ef-signal)] border-[var(--ef-ink)]'
                                    : 'bg-[var(--ef-ink)] border-[var(--ef-ink)] hover:bg-[var(--ef-chip)]'
                                }`}
                                style={{
                                  height: `${barHeight}px`,
                                  maxHeight: '100px',
                                  minHeight: '8px'
                                }}
                              />

                              <span
                                className={`text-[10px] font-mono ${
                                  isSelected ? 'font-bold text-[var(--ef-on-signal)] bg-[var(--ef-signal)] px-1' : 'text-[var(--ef-ink-2)]'
                                }`}
                              >
                                {dateStr.slice(5).replace('-', '.')}
                              </span>
                            </div>
                          )
                        })}
                    </div>

                    {recommended && (
                      <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-3 text-center border-t border-[var(--ef-rule)] pt-2">
                        // 建議每日目標熱量：{recommended} kcal（依當前體重 {selectedPet.weight} kg 估算模型計算）
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'advice' && (
              <div className="ef-panel p-5 mt-4 relative bg-[var(--ef-panel)] border border-[var(--ef-rule)] text-[var(--ef-ink)]">
                <div className="flex items-center justify-between mb-4 border-b border-[var(--ef-rule)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-[var(--ef-signal)] border border-[var(--ef-ink)]" />
                    <h2 className="text-sm font-bold text-[var(--ef-ink)]">
                      AI 個人化飲食建議
                    </h2>
                    <span className="ef-code">
                      MODEL // GROQ
                    </span>
                  </div>

                  <button
                    onClick={getAdvice}
                    disabled={loadingAdvice}
                    className="ef-btn go small flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles size={13} />
                    <span>{loadingAdvice ? '分析處理中...' : '取得智慧飲食建議'}</span>
                  </button>
                </div>

                {!dietAdvice && !loadingAdvice && !adviceError && (
                  <div className="border border-dashed border-[var(--ef-rule)] bg-[var(--ef-paper-2)] p-6 text-center font-mono text-xs text-[var(--ef-ink-2)]">
                    <p>
                      點擊「取得智慧飲食建議」，AI 將根據{' '}
                      <span className="text-[var(--ef-ink)] font-bold">
                        {selectedPet?.name}
                      </span>{' '}
                      的健康紀錄、生命週期與近期飲食，提供個人化專屬菜單分析
                    </p>
                    {consultations.length > 0 && (
                      <p className="text-[var(--ef-ink-2)] mt-1.5">
                        // 已索引並整合 {consultations.length} 筆歷史諮詢與照護紀錄
                      </p>
                    )}
                  </div>
                )}

                {loadingAdvice && (
                  <div className="border border-[var(--ef-rule)] bg-[var(--ef-paper-2)] p-6 text-center font-mono">
                    <div className="flex gap-1.5 justify-center mb-3">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-[var(--ef-signal)] border border-[var(--ef-ink)] animate-bounce"
                          style={{
                            animationDelay: `${i * 0.15}s`
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-[var(--ef-ink-2)]">
                      // 正在讀取近期熱量攝取與健康紀錄進行綜合推論分析...
                    </p>
                  </div>
                )}

                {adviceError && (
                  <div className="border border-[var(--ef-danger)] bg-[var(--ef-paper-2)] p-3 font-mono text-xs text-[var(--ef-danger)]">
                    [ERROR] {adviceError}
                  </div>
                )}

                {dietAdvice && (
                  <div className="border border-[var(--ef-ink)] bg-[var(--ef-paper)] p-4">
                    <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--ef-ink)] mb-2">
                      // ADVISORY_REPORT
                    </div>
                    <div
                      className="text-xs leading-relaxed text-[var(--ef-ink)] space-y-2 font-mono"
                      dangerouslySetInnerHTML={{
                        __html: dietAdvice
                          .replace(
                            /\*\*(.*?)\*\*/g,
                            '<strong class="font-bold text-[var(--ef-ink)] bg-[var(--ef-chip)] px-1">$1</strong>'
                          )
                          .replace(
                            /\n/g,
                            '<br/>'
                          )
                      }}
                    />

                    <div className="mt-4 pt-3 border-t border-[var(--ef-rule)] flex items-center justify-between font-mono text-[11px]">
                      <p className="text-[var(--ef-ink-2)]">
                        // 建議僅供日常飼育參考，若有特殊醫療需求請諮詢主治獸醫師
                      </p>
                      <button
                        onClick={getAdvice}
                        className="ef-btn ghost small"
                      >
                        [重新分析 // RE-ANALYZE]
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
      {showAddModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            className="relative bg-[var(--ef-panel)] border-2 border-[var(--ef-ink)] text-[var(--ef-ink)] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)'
            }}
          >
            <div className="h-1 bg-[var(--ef-signal)] border-b border-[var(--ef-ink)]" />

            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[var(--ef-rule)] pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-4 bg-[var(--ef-signal)] border border-[var(--ef-ink)]" />
                  <div>
                    <div className="ef-eyebrow">// RECORD_FEEDING</div>
                    <h2 className="text-base font-bold text-[var(--ef-ink)] uppercase tracking-wide">
                      新增餵食紀錄
                    </h2>
                    <p className="text-[10px] font-mono text-[var(--ef-ink-2)] mt-0.5">
                      影像辨識或手動輸入品項資料
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetAddForm()
                  }}
                  className="ef-btn ghost square small border border-[var(--ef-rule)] hover:border-[var(--ef-ink)]"
                  title="關閉"
                >
                  <X size={14} />
                </button>
              </div>

              {/* 智慧推薦 */}
              <div className="mb-5">
                {smartLoading && (
                  <div className="bg-[var(--ef-paper-2)] border border-[var(--ef-rule)] p-3 text-center">
                    <p className="text-xs font-mono font-bold text-[var(--ef-ink)]">
                      // ANALYZING // 正在分析近 7 日飲食狀況...
                    </p>
                  </div>
                )}

                {smartError && !smartLoading && (
                  <div className="bg-[var(--ef-paper-2)] border border-[var(--ef-danger)] p-3">
                    <p className="text-xs text-[var(--ef-danger)] font-mono">
                      [ERROR] {smartError}
                    </p>
                  </div>
                )}

                {smartDiet?.recommendation && !smartLoading && (
                  <div className="bg-[var(--ef-paper-2)] border border-[var(--ef-ink)] p-4 relative">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-[var(--ef-panel)] border border-[var(--ef-rule)] flex items-center justify-center shrink-0">
                        <Sparkles size={16} className="text-[var(--ef-signal)]" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="ef-chip active text-[10px]">
                          RECOMMENDED // 推薦
                        </span>

                        <p className="text-xs font-bold text-[var(--ef-ink)] mt-1.5">
                          {smartDiet.recommendation.title}
                        </p>

                        <p className="text-xs text-[var(--ef-ink-2)] mt-1 leading-relaxed">
                          {smartDiet.recommendation.recommendation}
                        </p>

                        <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-1.5">
                          // 依據：{smartDiet.recommendation.reason}
                        </p>

                        {suggestedFood && (
                          <button
                            type="button"
                            onClick={() => handleFoodSelect(String(suggestedFood.id))}
                            className="ef-btn go small mt-3 w-full"
                          >
                            採用推薦：{suggestedFood.name}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 模式切換 */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('image')
                    setAiError('')
                  }}
                  className={`py-2 text-xs font-mono font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                    inputMode === 'image'
                      ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] border-[var(--ef-ink)] font-bold'
                      : 'bg-[var(--ef-paper-2)] border-[var(--ef-rule)] text-[var(--ef-ink-2)] hover:border-[var(--ef-ink)]'
                  }`}
                  style={{
                    clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)'
                  }}
                >
                  <Camera size={13} />
                  <span>圖片辨識採樣 // IMAGE</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInputMode('manual')
                    setAiError('')
                  }}
                  className={`py-2 text-xs font-mono font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                    inputMode === 'manual'
                      ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] border-[var(--ef-ink)] font-bold'
                      : 'bg-[var(--ef-paper-2)] border-[var(--ef-rule)] text-[var(--ef-ink-2)] hover:border-[var(--ef-ink)]'
                  }`}
                  style={{
                    clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)'
                  }}
                >
                  <Edit3 size={13} />
                  <span>手動輸入品項 // MANUAL</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 圖片辨識模式 */}
                {inputMode === 'image' && (
                  <div className="space-y-4">
                    {!imagePreview ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-[var(--ef-rule)] hover:border-[var(--ef-ink)] hover:bg-[var(--ef-paper-2)] p-8 transition-all text-center group"
                      >
                        <div className="text-3xl mb-2 text-[var(--ef-ink-2)] group-hover:text-[var(--ef-ink)]">
                          📷
                        </div>
                        <p className="text-xs font-bold font-mono text-[var(--ef-ink)] uppercase">
                          上傳食物圖片 // UPLOAD IMAGE
                        </p>
                        <p className="text-[10px] font-mono text-[var(--ef-ink-2)] mt-1">
                          JPG / PNG，最大 10MB
                        </p>
                      </button>
                    ) : (
                      <div className="relative border border-[var(--ef-rule)]">
                        <img
                          src={imagePreview}
                          alt="食物預覽"
                          className="w-full h-48 object-cover"
                        />
                        <button
                          type="button"
                          onClick={clearImage}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/80 text-white flex items-center justify-center border border-white/20 hover:bg-black font-mono text-xs"
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
                        className="ef-btn go w-full py-2.5 text-xs font-mono font-bold uppercase disabled:opacity-50"
                      >
                        {aiAnalyzing
                          ? '🤖 AI 正在辨識食物...'
                          : '🤖 開始辨識食物與營養 // ANALYZE'}
                      </button>
                    )}

                    {aiError && (
                      <div className="bg-[var(--ef-paper-2)] border border-[var(--ef-danger)] p-3">
                        <p className="text-xs text-[var(--ef-danger)] font-mono">
                          [ERROR] {aiError}
                        </p>
                      </div>
                    )}

                    {aiResult && (
                      <div className="bg-[var(--ef-paper-2)] border border-[var(--ef-ink)] p-3.5">
                        <div className="flex items-center justify-between mb-3 border-b border-[var(--ef-rule)] pb-2">
                          <div>
                            <p className="text-xs font-mono font-bold text-[var(--ef-ink)]">
                              // AI 辨識結果 // INFERENCE
                            </p>
                            {aiResult.confidence != null && (
                              <p className="text-[10px] font-mono text-[var(--ef-ink-2)] mt-0.5">
                                信心度：{Math.round(Number(aiResult.confidence) * 100)}%
                              </p>
                            )}
                          </div>
                          <span className="ef-code">可修改 // EDITABLE</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                            <p className="text-[10px] font-mono text-[var(--ef-ink-2)]">食物</p>
                            <p className="text-xs font-bold font-mono text-[var(--ef-ink)] truncate">
                              {aiResult.foodName || '未知'}
                            </p>
                          </div>

                          <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                            <p className="text-[10px] font-mono text-[var(--ef-ink-2)]">估計份量</p>
                            <p className="text-xs font-bold font-mono text-[var(--ef-ink)]">
                              {aiResult.estimatedAmountG != null
                                ? `${aiResult.estimatedAmountG} g`
                                : '未估計'}
                            </p>
                          </div>

                          <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                            <p className="text-[10px] font-mono text-[var(--ef-ink-2)]">熱量</p>
                            <p className="text-xs font-bold font-mono text-[var(--ef-ink)]">
                              {aiResult.calories != null
                                ? `${aiResult.calories} kcal`
                                : '—'}
                            </p>
                          </div>

                          <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                            <p className="text-[10px] font-mono text-[var(--ef-ink-2)]">蛋白質</p>
                            <p className="text-xs font-bold font-mono text-[var(--ef-ink)]">
                              {aiResult.proteinG != null
                                ? `${aiResult.proteinG} g`
                                : '—'}
                            </p>
                          </div>

                          <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                            <p className="text-[10px] font-mono text-[var(--ef-ink-2)]">脂肪</p>
                            <p className="text-xs font-bold font-mono text-[var(--ef-ink)]">
                              {aiResult.fatG != null
                                ? `${aiResult.fatG} g`
                                : '—'}
                            </p>
                          </div>

                          <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                            <p className="text-[10px] font-mono text-[var(--ef-ink-2)]">碳水</p>
                            <p className="text-xs font-bold font-mono text-[var(--ef-ink)]">
                              {aiResult.carbG != null
                                ? `${aiResult.carbG} g`
                                : '—'}
                            </p>
                          </div>
                        </div>

                        {aiResult.note && (
                          <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-2.5 pt-2 border-t border-[var(--ef-rule)]">
                            // 備註：{aiResult.note}
                          </p>
                        )}
                      </div>
                    )}

                    {/* AI 結果可以繼續修改 */}
                    {aiResult && (
                      <div className="space-y-3 font-mono">
                        <div>
                          <label className="block text-[11px] font-bold text-[var(--ef-ink-2)] mb-1 uppercase">
                            // 食物名稱 // FOOD_NAME
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
                          <label className="block text-[11px] font-bold text-[var(--ef-ink-2)] mb-1 uppercase">
                            // 份量 (g) // AMOUNT
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
                                amountG: e.target.value
                              }))
                            }
                            className={inputCls}
                          />
                          <p className="text-[10px] text-[var(--ef-ink-2)] mt-1">
                            // 提示：若 AI 估算不準，可直接修改數值。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 手動輸入模式 */}
                {inputMode === 'manual' && (
                  <div className="space-y-4 font-mono">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ef-ink-2)] mb-1 uppercase">
                        // 從食物資料庫選擇 // DATABASE
                      </label>
                      <select
                        value={form.foodItemId}
                        onChange={e => handleFoodSelect(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">-- 從資料庫選擇 --</option>
                        {foods.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                            {f.brand ? ` (${f.brand})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ef-ink-2)] mb-1 uppercase">
                        // 食物名稱 * // FOOD_NAME (可手動輸入)
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

                        {form.foodName && !selectedFood && (
                          <button
                            type="button"
                            onClick={handleAiAnalyze}
                            disabled={aiAnalyzing}
                            className="ef-btn go small shrink-0 disabled:opacity-50"
                          >
                            {aiAnalyzing ? '...' : '🤖 AI 分析'}
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedFood && (
                      <div className="bg-[var(--ef-paper-2)] border border-[var(--ef-rule)] p-3">
                        <p className="text-[10px] font-mono font-bold text-[var(--ef-ink)] mb-2">
                          {selectedFood.notes
                            ? '// AI 估算結果'
                            : '// 資料庫基準資料'}
                        </p>

                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            ['熱量', selectedFood.calories_per_100g, 'kcal/100g'],
                            ['蛋白質', selectedFood.protein_pct, '%'],
                            ['脂肪', selectedFood.fat_pct, '%'],
                            ['碳水', selectedFood.carb_pct, '%']
                          ].map(([label, val, unit]) => (
                            <div key={label} className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                              <p className="text-[10px] font-mono text-[var(--ef-ink-2)]">
                                {label}
                              </p>
                              <p className="text-xs font-mono font-bold text-[var(--ef-ink)]">
                                {val ? `${val}` : '—'}
                              </p>
                              <p className="text-[9px] font-mono text-[var(--ef-ink-2)]">
                                {unit}
                              </p>
                            </div>
                          ))}
                        </div>

                        {selectedFood.notes && (
                          <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-2">
                            // 註：{selectedFood.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 餵食前檢查流程：健康歷史 → 近期飲食 → 營養與安全 → 確認 */}
                <FoodCheckSteps
                  warnings={foodWarnings}
                  checking={checkingFood}
                  checked={!!checkedFoodKey}
                />

                {/* 飲食警訊 */}
                {checkingFood && (
                  <div className="bg-[var(--ef-paper-2)] border border-[var(--ef-rule)] p-3 text-center font-mono">
                    <p className="text-xs text-[var(--ef-ink-2)]">
                      // CHECKING // 正在檢查食物是否適合當前健康狀況...
                    </p>
                  </div>
                )}

                {ackWarnings.length > 0 && !checkingFood && (
                  <div className="border-2 border-[var(--ef-signal-frame)] bg-[var(--ef-paper-2)] p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="text-sm font-mono font-bold bg-[var(--ef-signal)] text-[var(--ef-on-signal)] px-1">
                        !
                      </span>

                      <div className="flex-1">
                        <p className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ef-ink)]">
                          // DIET WARNING // 飲食警訊
                        </p>

                        <div className="space-y-2 mt-2">
                          {ackWarnings.map((warning, index) => (
                            <div
                              key={`${warning.title}-${index}`}
                              className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2.5 font-mono text-xs"
                            >
                              <p className="font-bold text-[var(--ef-ink)]">
                                {warning.title}
                              </p>
                              <p className="text-[var(--ef-ink-2)] mt-1 leading-relaxed">
                                {warning.reason}
                              </p>
                              {warning.suggestion && (
                                <p className="text-[var(--ef-ink)] font-semibold mt-1">
                                  // 建議：{warning.suggestion}
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
                              className="ef-btn ghost small"
                            >
                              修改食物 // MODIFY
                            </button>

                            <button
                              type="button"
                              onClick={() => setWarningAccepted(true)}
                              className="ef-btn go small"
                            >
                              仍要儲存 // PROCEED
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 bg-[var(--ef-panel)] border border-[var(--ef-ink)] px-3 py-1.5 font-mono text-xs text-[var(--ef-ink)]">
                            ✓ 已確認警訊，可繼續儲存此紀錄
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 健康提醒：只是提醒，不阻擋新增 */}
                {advisoryWarnings.length > 0 && !checkingFood && (
                  <div className="border border-[var(--ef-rule)] bg-[var(--ef-paper-2)] p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="text-sm font-mono font-bold bg-[var(--ef-chip)] text-[var(--ef-ink)] px-1">
                        i
                      </span>

                      <div className="flex-1">
                        <p className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ef-ink)]">
                          // ADVISORY NOTICE // 健康提醒
                        </p>

                        <div className="space-y-2 mt-2">
                          {advisoryWarnings.map((warning, index) => (
                            <div
                              key={`${warning.title}-${index}`}
                              className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2.5 font-mono text-xs"
                            >
                              <p className="font-bold text-[var(--ef-ink)]">
                                {warning.title}
                              </p>
                              <p className="text-[var(--ef-ink-2)] mt-1 leading-relaxed">
                                {warning.reason}
                              </p>
                              {warning.suggestion && (
                                <p className="text-[var(--ef-ink)] font-semibold mt-1">
                                  // 建議：{warning.suggestion}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <p className="text-[10px] font-mono text-[var(--ef-ink-2)] mt-2">
                          // 此提醒不阻擋操作，仍可正常新增餵食紀錄。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 份量與時間 */}
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ef-ink-2)] mb-1 uppercase">
                      // 份量 (g) * // AMOUNT
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
                          amountG: e.target.value
                        }))
                      }
                      placeholder="例如：60"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ef-ink-2)] mb-1 uppercase">
                      // 餵食時間 // TIME
                    </label>
                    <input
                      type="datetime-local"
                      value={form.fedAt}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          fedAt: e.target.value
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* 營養結果 */}
                {previewNutrition?.calories != null && (
                  <div className="bg-[var(--ef-paper-2)] border border-[var(--ef-rule)] p-3 font-mono">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-[var(--ef-ink)]">
                        {aiResult ? '// AI 估算本餐營養' : '// 本餐營養試算'}
                      </p>
                      {aiResult && (
                        <span className="text-[10px] text-[var(--ef-ink-2)]">
                          [IMAGE ESTIMATION]
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                        <p className="text-[10px] text-[var(--ef-ink-2)]">熱量</p>
                        <p className="text-xs font-bold font-mono text-[var(--ef-ink)]">
                          {previewNutrition.calories}
                        </p>
                        <p className="text-[9px] text-[var(--ef-ink-2)]">kcal</p>
                      </div>

                      <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                        <p className="text-[10px] text-[var(--ef-ink-2)]">蛋白質</p>
                        <p className="text-xs font-bold font-mono text-[var(--ef-ink)]">
                          {previewNutrition.proteinG ?? '—'}
                        </p>
                        <p className="text-[9px] text-[var(--ef-ink-2)]">g</p>
                      </div>

                      <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                        <p className="text-[10px] text-[var(--ef-ink-2)]">脂肪</p>
                        <p className="text-xs font-bold font-mono text-[var(--ef-ink)]">
                          {previewNutrition.fatG ?? '—'}
                        </p>
                        <p className="text-[9px] text-[var(--ef-ink-2)]">g</p>
                      </div>

                      <div className="bg-[var(--ef-panel)] border border-[var(--ef-rule)] p-2">
                        <p className="text-[10px] text-[var(--ef-ink-2)]">碳水</p>
                        <p className="text-xs font-bold font-mono text-[var(--ef-ink)]">
                          {previewNutrition.carbG ?? '—'}
                        </p>
                        <p className="text-[9px] text-[var(--ef-ink-2)]">g</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 備註 */}
                <div className="font-mono">
                  <label className="block text-[11px] font-bold text-[var(--ef-ink-2)] mb-1 uppercase">
                    // 備註 // REMARKS
                  </label>
                  <input
                    value={form.notes}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        notes: e.target.value
                      }))
                    }
                    placeholder="選填備註說明"
                    className={inputCls}
                  />
                </div>

                {/* 按鈕 */}
                <div className="flex gap-2 pt-3 border-t border-[var(--ef-rule)] font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      resetAddForm()
                    }}
                    className="ef-btn ghost flex-1 text-xs py-2"
                  >
                    取消 // CANCEL
                  </button>

                  <button
                    type="submit"
                    disabled={
                      addRecord.isPending ||
                      aiAnalyzing ||
                      checkingFood ||
                      !form.foodName ||
                      !form.amountG ||
                      (ackWarnings.length > 0 && !warningAccepted)
                    }
                    className="ef-btn go flex-1 text-xs py-2 disabled:opacity-50"
                  >
                    {addRecord.isPending
                      ? '記錄中...'
                      : checkingFood
                      ? '安全檢測中...'
                      : warningAccepted
                      ? '確認儲存紀錄 // CONFIRM'
                      : '確認餵食登錄 // SUBMIT'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}


    </div>
  )
}