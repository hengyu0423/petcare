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
    className: 'bg-[#fafafa] text-[#191919] border-[#d9d9d9]'
  },
  urgent: {
    label: '儘速就醫',
    className: 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]'
  },
  emergency: {
    label: '緊急警訊',
    className: 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]'
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
    'w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-2 text-xs text-[#191919] font-mono focus:border-[#191919] focus:outline-hidden transition-colors'

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]" data-theme="light">

      {/* 左側：選擇寵物 */}
      <PetDrawer open={petOpen} onClose={() => setPetOpen(false)} widthClass="md:w-60">

        <div className="px-4 py-4 border-b border-[#e5e5e5] bg-[#fafafa]">
          <h2 className="text-xs font-bold text-[#191919] uppercase tracking-wider font-mono">
            選擇寵物 // SELECT_PET
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">

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
                    ? 'bg-[#191919] text-[#fffa00] border-[#191919] font-bold'
                    : 'bg-white border-[#e5e5e5] hover:border-[#191919] text-[#191919]'
                }`}
              >
                <div
                  className={`w-8 h-8 flex items-center justify-center border shrink-0 ${
                    active
                      ? 'bg-[#fffa00] text-[#191919] border-[#fffa00]'
                      : 'bg-[#fafafa] text-[#191919] border-[#e5e5e5]'
                  }`}
                >
                  <Icon size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{pet.name}</p>
                  <p className={`text-[10px] font-mono truncate ${active ? 'text-[#fffa00]/80' : 'text-[#8a8a8a]'}`}>
                    {pet.weight ? `${pet.weight}kg` : pet.species}
                  </p>
                </div>
              </button>
            )
          })}

        </div>

        <div className="p-3 border-t border-[#e5e5e5]">
          <Link
            to="/food-database"
            className="group block w-full border border-[#d9d9d9] bg-white p-2.5 hover:border-[#191919] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#fafafa] border border-[#e5e5e5] flex items-center justify-center text-[#191919] shrink-0">
                <Database size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#191919] group-hover:text-black">
                  食物資料庫
                </p>
                <p className="text-[10px] font-mono text-[#8a8a8a] mt-0.5">
                  熱量與營養素庫
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
            <Utensils size={36} className="text-[#8a8a8a] mb-2" />
            <p className="font-bold text-sm text-[#191919]">請先由左側選擇寵物</p>
            <p className="text-xs font-mono text-[#8a8a8a]">管理與追蹤每日各餐攝取與安全建議</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#e5e5e5] pb-4">

              <div>
                <BracketTitle prefix="// NUTRITION.FEEDING">{selectedPet.name} 的飲食管理</BracketTitle>
                <p className="text-xs font-mono text-[#8a8a8a] mt-1 tracking-wider">
                  記錄與精算每日攝取熱量、蛋白質與飲食禁忌
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">

                <div className="flex items-center gap-1">

                  <button
                    onClick={() => goDay(-1)}
                    className="w-8 h-8 flex items-center justify-center border border-[#d9d9d9] bg-white hover:border-[#191919] text-[#191919] transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <div className="border border-[#d9d9d9] bg-white px-2.5 py-1.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#8a8a8a]" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="bg-transparent text-xs font-mono text-[#191919] focus:outline-hidden"
                    />
                  </div>

                  <button
                    onClick={() => goDay(1)}
                    disabled={selectedDate >= today}
                    className="w-8 h-8 flex items-center justify-center border border-[#d9d9d9] bg-white hover:border-[#191919] text-[#191919] transition-colors disabled:opacity-30"
                  >
                    <ChevronRight size={15} />
                  </button>

                  {selectedDate !== today && (
                    <button
                      onClick={() => setSelectedDate(today)}
                      className="text-[11px] font-mono font-bold text-[#191919] underline px-1"
                    >
                      TODAY
                    </button>
                  )}

                </div>

                <Button
                  variant="action"
                  onClick={openAddModal}
                  className="text-xs py-2 px-3.5 flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>新增餵食紀錄</span>
                </Button>

              </div>
            </div>

            {/* 分頁標籤：今日指引／健康提醒／給食紀錄／營養建議 */}
            <div className="flex items-center gap-1.5 border-b border-[#e5e5e5] pb-2 overflow-x-auto overflow-y-hidden">
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
                        ? 'bg-[#191919] text-[#fffa00] font-bold'
                        : 'bg-white border border-[#d9d9d9] text-[#555] hover:border-[#191919]'
                    }`}
                  >
                    <Icon size={12} />
                    <span>{tab.label}</span>

                    {tab.count > 0 && (
                      <span className="min-w-[15px] h-[15px] px-1 bg-[#fffa00] text-[#191919] text-[9px] font-bold font-mono flex items-center justify-center">
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
                  <div className="relative bg-white border border-[#e5e5e5] p-5 shadow-xs">
                    <CornerBrackets size="sm" />

                    <div className="flex items-center justify-between mb-4 border-b border-[#f0f0f0] pb-3">
                      <div>
                        <div className="text-[10px] font-mono font-bold tracking-wider text-[#8a8a8a]">
                          // HEALTH_EVENTS & NUTRITION_CAUTION
                        </div>
                        <h2 className="text-sm font-bold text-[#191919] flex items-center gap-2">
                          <HeartPulse size={15} className="text-[#191919]" />
                          <span>近期健康事件與飲食注意事項</span>
                        </h2>
                      </div>

                      <Link
                        to="/health-consult"
                        className="text-xs font-mono font-medium text-[#191919] hover:underline flex items-center gap-1"
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
                                ? 'border-[#191919] bg-[#fafafa]'
                                : 'border-[#e5e5e5] bg-[#fafafa]/50 opacity-70'
                            }`}
                          >
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-sm font-bold text-[#191919]">
                                {event.title}
                              </span>

                              {severity && (
                                <span
                                  className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${severity.className}`}
                                >
                                  {severity.label}
                                </span>
                              )}

                              <span className="text-xs font-mono text-[#8a8a8a]">
                                {event.date_str}
                              </span>

                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 border ${
                                  event.is_active
                                    ? 'border-[#191919] bg-[#fffa00] text-[#191919] font-bold'
                                    : 'border-[#d9d9d9] bg-white text-[#8a8a8a]'
                                }`}
                              >
                                {event.is_active
                                  ? `注意期至 ${event.diet_until_str}`
                                  : '已過注意期'}
                              </span>
                            </div>

                            {event.description && (
                              <p className="text-xs text-[#555] mt-2 leading-relaxed">
                                {event.description}
                              </p>
                            )}

                            {info.dietNotes && (
                              <p className="text-xs font-mono text-[#191919] bg-white border border-[#e5e5e5] p-2 mt-2">
                                // 飲食重點：{info.dietNotes}
                              </p>
                            )}

                            {info.avoidFoods?.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                <span className="text-xs font-mono text-[#8a8a8a]">
                                  應避免食材:
                                </span>
                                {info.avoidFoods.map(food => (
                                  <span
                                    key={food}
                                    className="text-xs font-mono bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 font-bold"
                                  >
                                    [X] {food}
                                  </span>
                                ))}
                              </div>
                            )}

                            {info.dietAdvice?.length > 0 && (
                              <ul className="mt-2 space-y-1 font-mono text-xs text-[#555]">
                                {info.dietAdvice.map(item => (
                                  <li key={item} className="flex items-start gap-1.5">
                                    <span className="text-[#8a8a8a]">//</span>
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
                      <div className="border border-dashed border-[#d9d9d9] bg-[#fafafa] p-4 text-center text-xs font-mono text-[#8a8a8a] mt-3">
                        // 目前無注意期內之健康警訊事件
                      </div>
                    )}

                    {pastHealthEvents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPastHealthEvents(v => !v)}
                        className="text-xs font-mono text-[#8a8a8a] hover:text-[#191919] mt-3 flex items-center gap-1"
                      >
                        <span>{showPastHealthEvents ? '▲ 收合已過注意期紀錄' : `▼ 展開已過注意期紀錄 (${pastHealthEvents.length})`}</span>
                      </button>
                    )}

                    <p className="text-[10px] font-mono text-[#8a8a8a] mt-3 border-t border-[#f0f0f0] pt-2">
                      // 系統建議僅供日常飼育參考，非臨床醫療診斷。智慧推薦與食材檢查流程將自動參照以上數據。
                    </p>
                  </div>
                )}

                {/* 飲食異常警訊 */}
                {dietAlerts?.alerts?.length > 0 && (
                  <div className="relative bg-white border border-[#e5e5e5] p-5 shadow-xs">
                    <CornerBrackets size="sm" />

                    <div className="flex items-center justify-between mb-4 border-b border-[#f0f0f0] pb-3">
                      <div>
                        <div className="text-[10px] font-mono font-bold tracking-wider text-[#8a8a8a]">
                          // DIETARY_ANOMALY_ALERTS
                        </div>
                        <h2 className="text-sm font-bold text-[#191919] flex items-center gap-2">
                          <AlertTriangle size={15} className="text-[#191919]" />
                          <span>飲食狀況提醒與警訊</span>
                        </h2>
                      </div>

                      {dietAlerts.basis?.enough && (
                        <span className="text-xs font-mono text-[#8a8a8a]">
                          近 {dietAlerts.basis.windowDays} 天 ({dietAlerts.basis.records} 筆紀錄分析)
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {dietAlerts.alerts.map(alert => (
                        <div
                          key={alert.id}
                          className={`border p-3.5 ${
                            alert.level === 'warning'
                              ? 'border-amber-300 bg-amber-50/60'
                              : 'border-[#e5e5e5] bg-[#fafafa]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {alert.level === 'warning' ? (
                              <AlertTriangle size={15} className="text-amber-700 shrink-0" />
                            ) : (
                              <Lightbulb size={15} className="text-[#191919] shrink-0" />
                            )}
                            <p className="text-sm font-bold text-[#191919]">
                              {alert.title}
                            </p>
                          </div>

                          <p className="text-xs text-[#555] mt-1.5 leading-relaxed">
                            {alert.message}
                          </p>

                          {alert.suggestion && (
                            <p className="text-xs font-mono text-amber-900 bg-amber-100/60 border-l-2 border-amber-400 pl-2 py-1 mt-2 leading-relaxed">
                              // 改善建議：{alert.suggestion}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {dietAlerts.basis?.skipped?.length > 0 && (
                      <p className="text-[11px] font-mono text-[#8a8a8a] mt-3">
                        {dietAlerts.basis.skipped.join(' // ')}
                      </p>
                    )}

                    <p className="text-[10px] font-mono text-[#8a8a8a] mt-3 border-t border-[#f0f0f0] pt-2">
                      // 以上為依近期餵食數據推算之趨勢分析與建議，若有疑慮請諮詢專業獸醫師。
                    </p>
                  </div>
                )}

                {dietHealthEvents.length === 0 && (!dietAlerts?.alerts || dietAlerts.alerts.length === 0) && (
                  <div className="relative bg-white border border-[#e5e5e5] p-8 text-center shadow-xs">
                    <CornerBrackets size="sm" />
                    <CheckCircle2 size={28} className="mx-auto mb-2 text-[#191919]" />
                    <p className="text-sm font-bold text-[#191919]">目前無任何異常提醒</p>
                    <p className="text-xs font-mono text-[#8a8a8a] mt-1">
                      // 毛孩飲食攝取正常且近期無特殊健康事件，請繼續保持！
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'records' && (
              <div className="space-y-4 mt-4">
                {/* 統計卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="relative bg-white border border-[#e5e5e5] p-4 shadow-xs">
                    <CornerBrackets size="sm" />
                    <div className="text-[10px] font-mono text-[#8a8a8a]">// CALORIES</div>
                    <p className="text-xs font-bold text-[#191919] mt-0.5">{formatDate(selectedDate)} 熱量</p>
                    <p className="text-2xl font-bold font-mono text-[#191919] mt-1">
                      {todayCalories.toFixed(0)}
                      <span className="text-xs font-normal text-[#8a8a8a] ml-1">KCAL</span>
                    </p>
                    {recommended && (
                      <div className="mt-2 pt-2 border-t border-[#f0f0f0]">
                        <div className="flex justify-between text-[11px] font-mono text-[#8a8a8a] mb-1">
                          <span>建議 {recommended} kcal</span>
                          <span className="font-bold text-[#191919]">{caloriePct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-[#f0f0f0] overflow-hidden border border-[#e5e5e5]">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${Math.min(caloriePct, 100)}%`,
                              backgroundColor: caloriePct > 100 ? '#ef4444' : '#fffa00'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative bg-white border border-[#e5e5e5] p-4 shadow-xs">
                    <CornerBrackets size="sm" />
                    <div className="text-[10px] font-mono text-[#8a8a8a]">// PROTEIN</div>
                    <p className="text-xs font-bold text-[#191919] mt-0.5">蛋白質</p>
                    <p className="text-2xl font-bold font-mono text-[#191919] mt-1">
                      {todayProtein.toFixed(1)}
                      <span className="text-xs font-normal text-[#8a8a8a] ml-1">G</span>
                    </p>
                    <p className="text-[11px] font-mono text-[#8a8a8a] mt-2 pt-2 border-t border-[#f0f0f0]">
                      總量佔比指標
                    </p>
                  </div>

                  <div className="relative bg-white border border-[#e5e5e5] p-4 shadow-xs">
                    <CornerBrackets size="sm" />
                    <div className="text-[10px] font-mono text-[#8a8a8a]">// FAT</div>
                    <p className="text-xs font-bold text-[#191919] mt-0.5">脂肪</p>
                    <p className="text-2xl font-bold font-mono text-[#191919] mt-1">
                      {todayFat.toFixed(1)}
                      <span className="text-xs font-normal text-[#8a8a8a] ml-1">G</span>
                    </p>
                    <p className="text-[11px] font-mono text-[#8a8a8a] mt-2 pt-2 border-t border-[#f0f0f0]">
                      脂質攝取估算
                    </p>
                  </div>

                  <div className="relative bg-white border border-[#e5e5e5] p-4 shadow-xs">
                    <CornerBrackets size="sm" />
                    <div className="text-[10px] font-mono text-[#8a8a8a]">// MEAL_COUNT</div>
                    <p className="text-xs font-bold text-[#191919] mt-0.5">餵食次數</p>
                    <p className="text-2xl font-bold font-mono text-[#191919] mt-1">
                      {records.length}
                      <span className="text-xs font-normal text-[#8a8a8a] ml-1">MEALS</span>
                    </p>
                    <p className="text-[11px] font-mono text-[#8a8a8a] mt-2 pt-2 border-t border-[#f0f0f0]">
                      今日餐次總結
                    </p>
                  </div>
                </div>

                {/* 餵食紀錄 */}
                <div className="relative bg-white border border-[#e5e5e5] shadow-xs">
                  <CornerBrackets size="sm" />

                  <div className="px-5 py-3.5 border-b border-[#f0f0f0] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono font-bold tracking-wider text-[#8a8a8a]">
                        // FEEDING_RECORDS
                      </div>
                      <h2 className="text-sm font-bold text-[#191919]">
                        {formatDate(selectedDate)} 餵食紀錄清單
                      </h2>
                    </div>

                    <Button
                      variant="action"
                      onClick={openAddModal}
                      className="text-xs py-1.5 px-3 flex items-center gap-1 font-mono"
                    >
                      <Plus size={13} />
                      <span>登記給食</span>
                    </Button>
                  </div>

                  {records.length === 0 ? (
                    <div className="py-12 text-center">
                      <Utensils size={28} className="mx-auto mb-2 text-[#8a8a8a] stroke-[1.5]" />
                      <p className="text-xs font-mono text-[#8a8a8a] mb-3">
                        // 這天尚無給食紀錄
                      </p>
                      {selectedDate === today && (
                        <button
                          onClick={openAddModal}
                          className="border border-[#191919] bg-[#fffa00] text-[#191919] hover:bg-black hover:text-[#fffa00] px-4 py-1.5 text-xs font-mono font-bold transition-colors"
                        >
                          + 登記第一筆給食紀錄
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-[#f0f0f0]">
                      {records.map(record => (
                        <div
                          key={record.id}
                          className="flex items-center gap-3.5 px-5 py-3 hover:bg-[#fafafa] transition-colors group"
                        >
                          <div className="w-9 h-9 border border-[#d9d9d9] bg-[#fafafa] flex items-center justify-center shrink-0">
                            {record.food_name?.includes('乾') ? (
                              <Utensils size={15} className="text-[#191919]" />
                            ) : record.food_name?.includes('罐') || record.food_name?.includes('濕') ? (
                              <Package size={15} className="text-[#191919]" />
                            ) : (
                              <Utensils size={15} className="text-[#191919]" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#191919] truncate">
                              {record.food_name}
                            </p>

                            <p className="text-xs font-mono text-[#8a8a8a] mt-0.5">
                              <span>{record.amount_g}g</span>
                              {record.calories && (
                                <span> // {Number(record.calories).toFixed(0)} kcal</span>
                              )}
                              {record.protein_g && (
                                <span> // 蛋白 {Number(record.protein_g).toFixed(1)}g</span>
                              )}
                              <span>
                                {' // '}
                                {new Date(record.fed_at).toLocaleTimeString('zh-TW', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </p>

                            {record.notes && (
                              <p className="text-xs text-[#555] mt-1 bg-[#fafafa] border-l border-[#191919] pl-1.5 py-0.5">
                                備註：{record.notes}
                              </p>
                            )}
                          </div>

                          {record.calories && (
                            <div className="text-right shrink-0">
                              <span className="font-mono text-xs font-bold text-[#191919] bg-[#fafafa] border border-[#e5e5e5] px-2 py-1">
                                {Number(record.calories).toFixed(0)} KCAL
                              </span>
                            </div>
                          )}

                          <button
                            onClick={() => {
                              if (confirm('確定刪除此筆餵食紀錄？')) {
                                deleteRecord.mutate(record.id)
                              }
                            }}
                            className="text-[#8a8a8a] hover:text-red-600 transition-colors shrink-0 p-1.5 opacity-70 group-hover:opacity-100"
                            aria-label="刪除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 近期熱量趨勢 */}
                {dailyStats.length > 0 && (
                  <div className="relative bg-white border border-[#e5e5e5] p-5 shadow-xs">
                    <CornerBrackets size="sm" />
                    <div className="flex items-center justify-between mb-4 border-b border-[#f0f0f0] pb-2">
                      <div>
                        <div className="text-[10px] font-mono font-bold tracking-wider text-[#8a8a8a]">
                          // 7_DAYS_CALORIE_TRENDS
                        </div>
                        <h2 className="text-sm font-bold text-[#191919]">近期熱量攝取趨勢</h2>
                      </div>
                      {recommended && (
                        <span className="text-xs font-mono text-[#8a8a8a]">
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
                              <span className="text-[10px] font-mono text-[#8a8a8a] h-4 leading-4">
                                {cal > 0 ? cal.toFixed(0) : ''}
                              </span>

                              <div
                                className={`w-full transition-colors border ${
                                  isSelected
                                    ? 'bg-[#fffa00] border-[#191919]'
                                    : 'bg-[#191919] border-[#191919] hover:bg-[#333]'
                                }`}
                                style={{
                                  height: `${barHeight}px`,
                                  maxHeight: '100px',
                                  minHeight: '8px'
                                }}
                              />

                              <span
                                className={`text-[10px] font-mono ${
                                  isSelected ? 'font-bold text-[#191919] bg-[#fffa00] px-1' : 'text-[#8a8a8a]'
                                }`}
                              >
                                {dateStr.slice(5)}
                              </span>
                            </div>
                          )
                        })}
                    </div>

                    {recommended && (
                      <p className="text-[11px] font-mono text-[#8a8a8a] mt-3 text-center border-t border-[#f0f0f0] pt-2">
                        // 建議每日目標熱量：{recommended} kcal（依當前體重 {selectedPet.weight} kg 估算模型計算）
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'advice' && (
              <>
            {/* AI 飲食建議 */}
            <div className="relative bg-white border border-[#e5e5e5] p-5 mt-4 shadow-xs">
              <CornerBrackets size="sm" />
              <div className="flex items-center justify-between mb-4 border-b border-[#f0f0f0] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-[#fffa00] border border-[#191919]" />
                  <h2 className="text-sm font-bold text-[#191919]">
                    AI 個人化飲食建議
                  </h2>
                  <span className="text-[10px] font-mono border border-[#e5e5e5] bg-[#fafafa] text-[#8a8a8a] px-2 py-0.5">
                    MODEL // GROQ
                  </span>
                </div>

                <button
                  onClick={getAdvice}
                  disabled={loadingAdvice}
                  className="flex items-center gap-1.5 border border-[#191919] bg-[#fffa00] hover:bg-black hover:text-[#fffa00] text-[#191919] px-3 py-1.5 text-xs font-mono font-bold transition-colors disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  <span>{loadingAdvice ? '分析處理中...' : '取得智慧飲食建議'}</span>
                </button>

              </div>

              {!dietAdvice &&
                !loadingAdvice &&
                !adviceError && (
                  <div className="border border-dashed border-[#d9d9d9] bg-[#fafafa] p-5 text-center font-mono text-xs text-[#8a8a8a]">
                    <p>
                      點擊「取得智慧飲食建議」，AI 將根據{' '}
                      <span className="text-[#191919] font-bold">
                        {selectedPet?.name}
                      </span>{' '}
                      的健康紀錄、生命週期與近期飲食，提供個人化專屬菜單分析
                    </p>
                    {consultations.length > 0 && (
                      <p className="text-[#555] mt-1.5">
                        // 已索引並整合 {consultations.length} 筆歷史諮詢與照護紀錄
                      </p>
                    )}
                  </div>
                )}

              {loadingAdvice && (
                <div className="border border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
                  <div className="flex gap-1.5 justify-center mb-2">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-[#191919] animate-bounce"
                        style={{
                          animationDelay: `${i * 0.15}s`
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-mono text-[#8a8a8a]">
                    // 正在讀取近期熱量攝取與健康紀錄進行綜合推論分析...
                  </p>
                </div>
              )}

              {adviceError && (
                <div className="border border-red-300 bg-red-50 p-3 font-mono text-xs text-red-700">
                  [ERROR] {adviceError}
                </div>
              )}

              {dietAdvice && (
                <div className="border border-[#191919] bg-white p-4 shadow-xs">
                  <div className="text-[10px] font-mono font-bold tracking-wider text-[#191919] mb-2">
                    // ADVISORY_REPORT
                  </div>
                  <div
                    className="text-xs leading-relaxed text-[#191919] space-y-2"
                    dangerouslySetInnerHTML={{
                      __html: dietAdvice
                        .replace(
                          /\*\*(.*?)\*\*/g,
                          '<strong class="font-bold text-[#191919]">$1</strong>'
                        )
                        .replace(
                          /\n/g,
                          '<br/>'
                        )
                    }}
                  />

                  <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex items-center justify-between font-mono text-[11px]">
                    <p className="text-[#8a8a8a]">
                      // 建議僅供日常飼育參考，若有特殊醫療需求請諮詢主治獸醫師
                    </p>
                    <button
                      onClick={getAdvice}
                      className="text-[#191919] font-bold hover:underline"
                    >
                      [重新分析]
                    </button>
                  </div>
                </div>
              )}

            </div>

              </>
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
        <div className="fixed inset-0 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" data-theme="light">

          <div className="relative bg-white border border-[#191919] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CornerBrackets size="md" />

            <div className="p-6">

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-5">

                <div className="flex items-center gap-2">
                  <div className="w-2 h-4 bg-[#fffa00]" />
                  <div>
                    <h2 className="text-base font-bold text-[#191919]">
                      新增餵食紀錄
                    </h2>
                    <p className="text-[10px] font-mono text-[#8a8a8a] mt-0.5">
                      影像辨識或手動輸入 // RECORD_FEEDING
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetAddForm()
                  }}
                  className="w-7 h-7 flex items-center justify-center border border-[#e5e5e5] text-[#8a8a8a] hover:text-[#191919] hover:border-[#191919] transition-colors"
                >
                  <X size={14} />
                </button>

              </div>

              {/* 智慧推薦 */}
              <div className="mb-5">
                {smartLoading && (
                  <div className="bg-[#fafafa] border border-[#d9d9d9] p-3 text-center">
                    <p className="text-xs font-mono font-bold text-[#191919]">
                      正在分析近 7 日飲食狀況... // ANALYZING
                    </p>
                  </div>
                )}

                {smartError && !smartLoading && (
                  <div className="bg-[#fff5f5] border border-[#ef4444] p-3">
                    <p className="text-xs text-[#ef4444] font-mono">
                      {smartError}
                    </p>
                  </div>
                )}

                {smartDiet?.recommendation && !smartLoading && (
                  <div className="bg-[#fafafa] border border-[#191919] p-4 shadow-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-white border border-[#d9d9d9] flex items-center justify-center shrink-0">
                        <Sparkles size={16} className="text-[#191919]" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-[#191919] bg-[#fffa00] px-1.5 py-0.2">
                          RECOMMENDED
                        </span>

                        <p className="text-xs font-bold text-[#191919] mt-1.5">
                          {smartDiet.recommendation.title}
                        </p>

                        <p className="text-xs text-[#555] mt-1 leading-relaxed">
                          {smartDiet.recommendation.recommendation}
                        </p>

                        <p className="text-[11px] font-mono text-[#8a8a8a] mt-1.5">
                          依據：{smartDiet.recommendation.reason}
                        </p>

                        {suggestedFood && (
                          <Button
                            type="button"
                            variant="action"
                            onClick={() =>
                              handleFoodSelect(String(suggestedFood.id))
                            }
                            className="mt-3 w-full py-1.5 text-xs"
                          >
                            採用推薦：{suggestedFood.name}
                          </Button>
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
                      ? 'bg-[#191919] text-[#fffa00] border-[#191919]'
                      : 'bg-[#fafafa] border-[#d9d9d9] text-[#555] hover:border-[#191919]'
                  }`}
                >
                  <Camera size={13} />
                  <span>圖片辨識採樣</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInputMode('manual')
                    setAiError('')
                  }}
                  className={`py-2 text-xs font-mono font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                    inputMode === 'manual'
                      ? 'bg-[#191919] text-[#fffa00] border-[#191919]'
                      : 'bg-[#fafafa] border-[#d9d9d9] text-[#555] hover:border-[#191919]'
                  }`}
                >
                  <Edit3 size={13} />
                  <span>手動輸入品項</span>
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

                {/* 餵食前檢查流程：健康歷史 → 近期飲食 → 營養與安全 → 確認 */}
                <FoodCheckSteps
                  warnings={foodWarnings}
                  checking={checkingFood}
                  checked={!!checkedFoodKey}
                />

                {/* 飲食警訊 */}
                {checkingFood && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">
                      🔎 正在檢查這個食物是否適合目前狀況...
                    </p>
                  </div>
                )}

                {ackWarnings.length > 0 && !checkingFood && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl">⚠️</span>

                      <div className="flex-1">
                        <p className="text-sm font-bold text-amber-800">
                          飲食警訊
                        </p>

                        <div className="space-y-3 mt-2">
                          {ackWarnings.map((warning, index) => (
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

                {/* 健康提醒：只是提醒，不阻擋新增 */}
                {advisoryWarnings.length > 0 && !checkingFood && (
                  <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl">⚠️</span>

                      <div className="flex-1">
                        <p className="text-sm font-bold text-amber-800">
                          健康提醒
                        </p>

                        <div className="space-y-2 mt-2">
                          {advisoryWarnings.map((warning, index) => (
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

                        <p className="text-xs text-amber-700/80 mt-2">
                          這只是提醒，仍可正常新增餵食紀錄。
                        </p>
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
                <div className="flex gap-2 pt-3 border-t border-[#e5e5e5]">

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowAddModal(false)
                      resetAddForm()
                    }}
                    className="flex-1 border border-[#d9d9d9] py-2 text-xs"
                  >
                    取消
                  </Button>

                  <Button
                    type="submit"
                    variant="action"
                    disabled={
                      addRecord.isPending ||
                      aiAnalyzing ||
                      checkingFood ||
                      !form.foodName ||
                      !form.amountG ||
                      (ackWarnings.length > 0 && !warningAccepted)
                    }
                    className="flex-1 py-2 text-xs"
                  >
                    {addRecord.isPending
                      ? '記錄中...'
                      : checkingFood
                      ? '安全檢測中...'
                      : warningAccepted
                      ? '確認儲存紀錄'
                      : '確認餵食登錄'}
                  </Button>

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