import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CornerBrackets,
  Button,
  BracketTitle,
  Tag
} from '@endfield-ui/react'
import {
  Camera,
  Upload,
  Sparkles,
  Smartphone,
  Video,
  VideoOff,
  AlertCircle,
  CheckCircle2,
  ScanFace,
  Eye,
  Activity,
  Focus,
  Moon,
  Zap,
  Compass,
  Smile,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  X,
  History,
  Clock,
  Filter,
  Layers
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

function getMoodBadge(mood) {
  if (!mood) return { icon: Moon, cls: 'border-[#191919] bg-[#fafafa] text-[#191919]', borderL: 'border-l-4 border-l-[#191919]', label: '未知狀態' }
  if (mood.includes('活躍') || mood.includes('興奮') || mood.includes('開心') || mood.includes('開朗')) {
    return { icon: Zap, cls: 'border-[#191919] bg-[#fffa00] text-[#191919] font-bold shadow-xs', borderL: 'border-l-4 border-l-[#fffa00]', label: mood }
  }
  if (mood.includes('好奇') || mood.includes('探索') || mood.includes('專注') || mood.includes('觀察')) {
    return { icon: Eye, cls: 'border-sky-400 bg-sky-100 text-sky-900 font-bold shadow-xs', borderL: 'border-l-4 border-l-sky-500', label: mood }
  }
  if (mood.includes('放鬆') || mood.includes('平靜') || mood.includes('休息') || mood.includes('舒適') || mood.includes('安心')) {
    return { icon: Moon, cls: 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold shadow-xs', borderL: 'border-l-4 border-l-emerald-500', label: mood }
  }
  if (mood.includes('警戒') || mood.includes('警惕')) {
    return { icon: Compass, cls: 'border-amber-400 bg-amber-100 text-amber-900 font-bold shadow-xs', borderL: 'border-l-4 border-l-amber-500', label: mood }
  }
  if (mood.includes('緊張') || mood.includes('焦慮') || mood.includes('害怕') || mood.includes('緊繃') || mood.includes('恐懼')) {
    return { icon: ShieldAlert, cls: 'border-rose-400 bg-rose-100 text-rose-900 font-bold shadow-xs', borderL: 'border-l-4 border-l-rose-500', label: mood }
  }
  return { icon: Smile, cls: 'border-indigo-300 bg-indigo-50 text-indigo-900 font-bold shadow-xs', borderL: 'border-l-4 border-l-indigo-500', label: mood }
}

function extractMoodFromAnalysis(text) {
  if (!text) return '放鬆'
  const match = text.match(/可能的情緒[：:]\s*([^\n\r]+)/)
  if (match) {
    const raw = match[1].trim()
    if (raw.includes('活躍') || raw.includes('興奮') || raw.includes('開朗')) return '活躍'
    if (raw.includes('好奇') || raw.includes('探索') || raw.includes('專注')) return '好奇'
    if (raw.includes('放鬆') || raw.includes('平靜') || raw.includes('舒適') || raw.includes('安心')) return '放鬆'
    if (raw.includes('警戒') || raw.includes('警惕') || raw.includes('觀察')) return '警戒'
    if (raw.includes('緊張') || raw.includes('焦慮') || raw.includes('恐懼') || raw.includes('緊繃')) return '緊張'
    return raw.slice(0, 8)
  }
  return '放鬆'
}

export default function PetEmotion({
  embedded = false,
  selectedPet = null,
  pets = [],
  onSelectPet = null
}) {
  const qc = useQueryClient()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  // 歷史篩選：時間跨度 & 展開項目
  const [range, setRange] = useState('today') // 'today' | '24h' | '7d'
  const [expandedLogId, setExpandedLogId] = useState(null)
  const [activePetId, setActivePetId] = useState(selectedPet?.id || null)

  // 當外部傳入 selectedPet 改變時同步
  useEffect(() => {
    if (selectedPet?.id) {
      setActivePetId(selectedPet.id)
    }
  }, [selectedPet?.id])

  // 若外部未給 pets，則自動自後端取得
  const { data: fetchedPets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data?.data || []).catch(() => []),
    enabled: !pets || !pets.length
  })

  const petList = Array.isArray(pets) && pets.length ? pets : (Array.isArray(fetchedPets) ? fetchedPets : [])
  const currentPet = petList.find(p => p?.id === activePetId) || petList[0] || null

  useEffect(() => {
    if (!activePetId && currentPet?.id) {
      setActivePetId(currentPet.id)
    }
  }, [currentPet?.id, activePetId])

  // 照片預覽處理
  useEffect(() => {
    if (!photo) {
      setPreview('')
      return
    }

    const url = URL.createObjectURL(photo)
    setPreview(url)

    return () => URL.revokeObjectURL(url)
  }, [photo])

  // 離開頁面時關閉鏡頭
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  // 取得該寵物的情緒歷史紀錄
  const { data: moodRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['pet-mood-records', currentPet?.id, range],
    queryFn: async () => {
      if (!currentPet?.id) return []
      try {
        const url =
          range === 'today'
            ? `/mood-records/pet/${currentPet.id}/today`
            : range === '24h'
            ? `/mood-records/pet/${currentPet.id}?minutes=1440`
            : `/mood-records/pet/${currentPet.id}?minutes=10080`
        const res = await api.get(url)
        return Array.isArray(res.data?.records) ? res.data.records : []
      } catch (e) {
        console.error('取得歷史情緒紀錄失敗：', e)
        return []
      }
    },
    enabled: !!currentPet?.id,
    refetchInterval: 30000
  })

  // 取得情緒摘要統計
  const { data: moodSummary } = useQuery({
    queryKey: ['mood-summary', currentPet?.id, range],
    queryFn: async () => {
      if (!currentPet?.id) return null
      try {
        const minutes = range === 'today' ? 1440 : range === '24h' ? 1440 : 10080
        const res = await api.get(`/mood-records/pet/${currentPet.id}/summary?minutes=${minutes}`)
        return res.data || null
      } catch (e) {
        console.error('取得情緒摘要失敗：', e)
        return null
      }
    },
    enabled: !!currentPet?.id,
    refetchInterval: 30000
  })

  // 儲存於本地之 AI 拍照分析紀錄
  const [photoLogs, setPhotoLogs] = useState(() => {
    if (!currentPet?.id) return []
    try {
      const saved = localStorage.getItem(`paw-photo-emotion-${currentPet.id}`)
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  // 當切換寵物時讀取對應的 AI 拍照歷史
  useEffect(() => {
    if (!currentPet?.id) {
      setPhotoLogs([])
      return
    }
    try {
      const saved = localStorage.getItem(`paw-photo-emotion-${currentPet.id}`)
      const parsed = saved ? JSON.parse(saved) : []
      setPhotoLogs(Array.isArray(parsed) ? parsed : [])
    } catch {
      setPhotoLogs([])
    }
  }, [currentPet?.id])

  // 驗證並儲存照片
  function handleFileSelected(file) {
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setError('格式不支援：請上傳 JPG、PNG 或 WebP 影像檔案')
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      setError('檔案容量超限：照片檔案大小不可超過 3 MB')
      return
    }

    closeCamera()
    setPhoto(file)
    setResult('')
    setError('')
  }

  // 開啟電腦攝影機
  async function openCamera() {
    setError('')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('瀏覽器不支援攝影機')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraOn(true)
      setPhoto(null)
      setResult('')
    } catch (err) {
      closeCamera()
      setError('無法開啟攝影機，請檢查攝影機權限設定')
    }
  }

  // 關閉攝影機
  function closeCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraOn(false)
  }

  // 電腦攝影機拍照
  function takePhoto() {
    const video = videoRef.current

    if (!video || !video.videoWidth) {
      setError('光學鏡頭訊號尚未就緒')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) {
        setError('擷取影像失敗')
        return
      }

      const file = new File([blob], 'pet_capture.jpg', {
        type: 'image/jpeg'
      })

      setPhoto(file)
      setResult('')
      setError('')
      closeCamera()
    }, 'image/jpeg', 0.85)
  }

  function uploadPhoto(event) {
    const file = event.target.files?.[0]
    handleFileSelected(file)
    event.target.value = ''
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelected(file)
    }
  }

  // AI 心情分析呼叫
  async function analyze() {
    if (!photo) {
      setError('請先拍照或上傳毛孩神情照片')
      return
    }

    if (loading) return

    setLoading(true)
    setResult('')
    setError('')

    const formData = new FormData()
    formData.append('photo', photo)

    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
      const token = useAuthStore.getState().token

      const response = await fetch(`${apiUrl}/api/pet-emotion`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`API 伺服器錯誤代碼：${response.status}`)
      }

      const data = await response.json()

      if (!data.analysis) {
        throw new Error('AI 未能產生有效的情緒分析回覆')
      }

      const analysisText = data.analysis
      setResult(analysisText)

      // 解析情緒並同步記錄至後端資料庫與本地儲存
      const moodTitle = extractMoodFromAnalysis(analysisText)
      const nowIso = new Date().toISOString()

      if (currentPet?.id) {
        api.post('/mood-records', {
          petId: currentPet.id,
          mood: moodTitle,
          behavior: 'AI 照片神情分析',
          confidence: 0.95
        }).then(() => {
          qc.invalidateQueries({ queryKey: ['pet-mood-records', currentPet.id] })
          qc.invalidateQueries({ queryKey: ['mood-summary', currentPet.id] })
        }).catch(console.error)

        // 存入本地歷史快照
        const newLog = {
          id: `ai-${Date.now()}`,
          mood: moodTitle,
          analysis: analysisText,
          recordedAt: nowIso,
          thumb: preview
        }

        setPhotoLogs(prev => {
          const updated = [newLog, ...prev.slice(0, 20)]
          try {
            localStorage.setItem(`paw-photo-emotion-${currentPet.id}`, JSON.stringify(updated))
          } catch {}
          return updated
        })
      }
    } catch (err) {
      console.error(err)
      setError('AI 分析服務暫時無法回應，請確認網路或後端連線')
    } finally {
      setLoading(false)
    }
  }

  // 合併與排序紀錄：攝影機偵測與 AI 拍照分析
  const allTimelineRecords = useMemo(() => {
    if (!Array.isArray(moodRecords)) return []
    return [...moodRecords].sort((a, b) => {
      const tA = new Date(a?.recordedAt || a?.recorded_at || 0).getTime()
      const tB = new Date(b?.recordedAt || b?.recorded_at || 0).getTime()
      return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA)
    })
  }, [moodRecords])

  return (
    <div
      className={embedded ? 'p-4 md:p-6 space-y-5' : 'p-6 md:p-10 max-w-7xl mx-auto space-y-6'}
      data-theme="light"
    >
      {/* 標題列 */}
      <div className="border-b border-[#e5e5e5] pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <BracketTitle prefix="// NEURAL.EMOTION">AI 寵物情緒辨識與歷史紀錄</BracketTitle>
          <p className="text-xs font-mono text-[#8a8a8a] mt-1 tracking-wider">
            拍照即時神經網路辨識，並整合即時影像監控之歷史情緒數據流
          </p>
        </div>

        {/* 寵物快速切換器 */}
        {petList.length > 0 && (
          <div className="flex items-center gap-1.5 border border-[#191919] p-0.5 font-mono text-xs bg-white">
            <span className="px-2 py-0.5 text-[#8a8a8a] text-[10px] uppercase font-bold">TARGET:</span>
            {petList.map(p => {
              const active = p.id === currentPet?.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActivePetId(p.id)
                    if (onSelectPet) onSelectPet(p.id)
                  }}
                  className={`px-2.5 py-1 font-bold transition-colors ${
                    active ? 'bg-[#191919] text-[#fffa00]' : 'text-[#555] hover:text-[#191919]'
                  }`}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 主工作區：左側 即時採集與拍照分析 + 右側 歷史情緒紀錄 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 左側：影像採集與即時分析 (6 cols on lg) */}
        <div className="lg:col-span-6 space-y-4">
          {/* 控制面板 */}
          <div className="relative bg-white border border-[#e5e5e5] p-4 shadow-xs">
            <CornerBrackets size="sm" />

            <div className="text-[10px] font-mono font-bold text-[#8a8a8a] uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>// CAPTURE_CONTROL // 影像來源採集</span>
              <span className="text-[#191919] font-bold">
                {cameraOn ? 'CAMERA_LIVE' : preview ? 'SAMPLE_LOADED' : 'STANDBY'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!cameraOn ? (
                <button
                  type="button"
                  onClick={openCamera}
                  disabled={loading}
                  className="px-3.5 py-2 border border-[#191919] bg-white hover:bg-[#fffa00] text-[#191919] text-xs font-mono font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Video size={14} />
                  <span>開啟電腦鏡頭</span>
                </button>
              ) : (
                <>
                  <Button
                    variant="action"
                    onClick={takePhoto}
                    className="text-xs py-2 px-4 flex items-center gap-1.5 font-mono"
                  >
                    <Camera size={14} />
                    <span>即刻拍攝採樣</span>
                  </Button>
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="px-3.5 py-2 border border-[#d9d9d9] bg-white hover:border-[#191919] text-[#555] text-xs font-mono font-medium transition-colors"
                  >
                    <VideoOff size={14} className="inline mr-1" />
                    關閉鏡頭
                  </button>
                </>
              )}

              {/* 手機拍照按鈕 */}
              <label className="px-3.5 py-2 border border-[#d9d9d9] bg-white hover:border-[#191919] text-[#191919] text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition-colors">
                <Smartphone size={14} />
                <span>手機相機拍照</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={uploadPhoto}
                  disabled={loading}
                  className="hidden"
                />
              </label>

              {/* 本機上傳圖片檔案 */}
              <label className="px-3.5 py-2 border border-[#d9d9d9] bg-white hover:border-[#191919] text-[#191919] text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition-colors">
                <Upload size={14} />
                <span>上傳照片檔案</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={uploadPhoto}
                  disabled={loading}
                  className="hidden"
                />
              </label>

              {preview && !cameraOn && (
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null)
                    setResult('')
                    setError('')
                  }}
                  className="px-2 py-2 text-xs font-mono text-[#8a8a8a] hover:text-red-600 transition-colors ml-auto flex items-center gap-1"
                >
                  <X size={13} />
                  <span>清除</span>
                </button>
              )}
            </div>
          </div>

          {/* 光學觀景窗主體 (Viewfinder HUD) */}
          <div className="relative bg-white border border-[#191919] p-4 shadow-sm">
            <CornerBrackets size="md" />

            <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-2.5 mb-3 text-[10px] font-mono text-[#8a8a8a]">
              <div className="flex items-center gap-2">
                <Focus size={13} className="text-[#191919]" />
                <span className="font-bold text-[#191919]">OPTICAL_VIEWFINDER</span>
                <span>// GRID: 1920x1080</span>
              </div>
              <div className="flex items-center gap-3">
                {photo && (
                  <span className="text-[#191919] font-bold">
                    {(photo.size / 1024).toFixed(1)} KB
                  </span>
                )}
                <span>STATUS: {cameraOn ? 'LIVE_STREAM' : photo ? 'TARGET_LOCKED' : 'READY'}</span>
              </div>
            </div>

            {cameraOn ? (
              /* 鏡頭畫面 */
              <div className="relative bg-black border border-[#191919] overflow-hidden min-h-[300px] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full max-h-[380px] object-contain mx-auto"
                />
                <div className="absolute top-3 left-3 bg-[#191919]/80 px-2.5 py-1 text-[11px] font-mono text-[#fffa00] flex items-center gap-1.5 border border-[#fffa00]">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
                  <span>OPTICAL SENSOR ACTIVE // LIVE</span>
                </div>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-28 h-28 border border-[#fffa00]/40 rounded-full flex items-center justify-center">
                    <div className="w-2.5 h-2.5 border border-[#fffa00]" />
                  </div>
                </div>
              </div>
            ) : preview ? (
              /* 照片預覽 */
              <div className="space-y-4">
                <div className="relative bg-[#fafafa] border border-[#e5e5e5] p-3 overflow-hidden flex items-center justify-center min-h-[260px]">
                  <span className="absolute top-2 left-2 text-[#8a8a8a] text-[10px] font-mono">[+]</span>
                  <span className="absolute top-2 right-2 text-[#8a8a8a] text-[10px] font-mono">[+]</span>
                  <span className="absolute bottom-2 left-2 text-[#8a8a8a] text-[10px] font-mono">[+]</span>
                  <span className="absolute bottom-2 right-2 text-[#8a8a8a] text-[10px] font-mono">[+]</span>

                  <img
                    src={preview}
                    alt="寵物神情採樣預覽"
                    className="max-h-72 w-auto object-contain mx-auto border border-[#d9d9d9] shadow-xs"
                  />
                </div>

                <Button
                  variant="action"
                  onClick={analyze}
                  disabled={loading || !photo}
                  className="w-full py-3 text-xs font-mono font-bold tracking-wider flex items-center justify-center gap-2"
                >
                  <Sparkles size={15} />
                  <span>{loading ? '多模態神經網路解碼中...' : '開始 AI 心情特徵分析 // INITIATE_ANALYSIS'}</span>
                </Button>
              </div>
            ) : (
              /* 預設拖曳上傳光學感應區 (Dropzone) */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#191919] bg-[#fffa00]/10'
                    : 'border-[#d9d9d9] hover:border-[#191919] bg-[#fafafa] hover:bg-white'
                }`}
              >
                <span className="absolute top-3 left-3 text-[#8a8a8a] text-[10px] font-mono">TL // 001</span>
                <span className="absolute top-3 right-3 text-[#8a8a8a] text-[10px] font-mono">TR // 002</span>
                <span className="absolute bottom-3 left-3 text-[#8a8a8a] text-[10px] font-mono">BL // 003</span>
                <span className="absolute bottom-3 right-3 text-[#8a8a8a] text-[10px] font-mono">BR // 004</span>

                <div className="w-12 h-12 mx-auto mb-3 border border-[#191919] bg-white flex items-center justify-center text-[#191919] shadow-xs">
                  <ScanFace size={24} className="stroke-[1.5]" />
                </div>

                <p className="text-xs font-bold text-[#191919]">
                  拖曳照片至此，或點擊選擇檔案
                </p>
                <p className="text-[11px] font-mono text-[#8a8a8a] mt-1">
                  支援 JPG, PNG, WEBP // 上限 3 MB
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-700 text-xs flex items-center gap-2 font-mono">
              <AlertCircle size={14} className="shrink-0" />
              <span>[ERROR] {error}</span>
            </div>
          )}

          {/* 當前分析結果展示 */}
          {result && (
            <div className="relative bg-white border border-[#191919] border-t-4 border-t-[#fffa00] p-5 shadow-sm">
              <CornerBrackets size="sm" />

              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-3.5 bg-[#fffa00] border border-[#191919]" />
                  <span className="font-bold text-xs text-[#191919]">AI 神經網路情緒診斷結果</span>
                </div>
                <span className="bg-[#191919] text-[#fffa00] px-2 py-0.5 border border-[#191919] font-mono font-bold text-[10px] shadow-2xs">
                  NEW_ANALYSIS
                </span>
              </div>

              <div className="text-xs text-[#191919] leading-relaxed whitespace-pre-wrap font-sans bg-gradient-to-br from-amber-50/40 via-[#fafafa] to-white border border-amber-200/80 p-3.5 shadow-2xs">
                {result}
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#e5e5e5] text-[10px] font-mono text-[#8a8a8a] flex items-center justify-between">
                <span>✓ 分析資料已同步匯入歷史情緒紀錄流</span>
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null)
                    setResult('')
                  }}
                  className="font-bold text-[#191919] hover:underline"
                >
                  [清除結果]
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右側：歷史情緒紀錄 (6 cols on lg) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative bg-white border border-[#191919] p-4 shadow-sm">
            <CornerBrackets size="sm" />

            {/* 歷史抬頭與時間範圍切換 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f0f0] pb-3 mb-3">
              <div>
                <div className="text-[10px] font-mono font-bold text-[#8a8a8a] tracking-wider">
                  // EMOTION_LOGS // 歷史情緒紀錄
                </div>
                <h3 className="text-sm font-bold text-[#191919]">
                  {currentPet ? `${currentPet.name} 的情緒變化紀錄` : '毛孩歷史情緒紀錄'}
                </h3>
              </div>

              {/* 時間跨度切換 */}
              <div className="inline-flex border border-[#191919] p-0.5 font-mono text-[11px] bg-white">
                {[
                  ['today', '今日 TODAY'],
                  ['24h', '24小時 24H'],
                  ['7d', '7天 7D']
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRange(key)}
                    className={`px-2 py-0.5 font-bold transition-colors ${
                      range === key ? 'bg-[#191919] text-[#fffa00]' : 'text-[#626262] hover:text-[#191919]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 情緒摘要統計小卡 */}
            <div className="grid grid-cols-3 gap-2 mb-3.5 text-xs font-mono">
              <div className="border border-sky-300 border-t-4 border-t-sky-500 bg-gradient-to-b from-sky-50/70 to-white p-2.5 shadow-xs">
                <span className="text-[10px] text-sky-800 font-bold block">// TOTAL_SAMPLES</span>
                <span className="text-sm font-bold text-sky-950 mt-0.5 block">
                  {allTimelineRecords.length} 筆
                </span>
              </div>

              <div className="border border-amber-300 border-t-4 border-t-amber-500 bg-gradient-to-b from-amber-50/70 to-white p-2.5 shadow-xs">
                <span className="text-[10px] text-amber-800 font-bold block">// DOMINANT_MOOD</span>
                <span className="text-xs font-bold text-[#191919] mt-1 inline-flex items-center gap-1 bg-[#fffa00] px-1.5 py-0.5 border border-[#191919] shadow-2xs">
                  {moodSummary?.mainMood || (allTimelineRecords[0]?.mood) || '尚無數據'}
                </span>
              </div>

              <div className="border border-violet-300 border-t-4 border-t-violet-500 bg-gradient-to-b from-violet-50/70 to-white p-2.5 shadow-xs">
                <span className="text-[10px] text-violet-800 font-bold block">// RATIO</span>
                <span className="text-sm font-bold text-violet-950 mt-0.5 block">
                  {moodSummary?.percentage ? `${moodSummary.percentage}%` : '--'}
                </span>
              </div>
            </div>

            {/* 歷史時間軸列表 */}
            {recordsLoading ? (
              <div className="h-48 flex items-center justify-center font-mono text-xs text-[#8a8a8a]">
                讀取情緒紀錄流中... // LOADING_TELEMETRY
              </div>
            ) : allTimelineRecords.length === 0 && photoLogs.length === 0 ? (
              <div className="border border-dashed border-[#d9d9d9] bg-[#fafafa] p-8 text-center">
                <Activity size={24} className="mx-auto mb-2 text-[#8a8a8a]" />
                <p className="text-xs font-bold text-[#191919]">目前在此區間尚無情緒紀錄</p>
                <p className="text-[11px] font-mono text-[#8a8a8a] mt-1 leading-relaxed">
                  可使用左側「開啟鏡頭」或「上傳照片」進行 AI 心情分析，<br />
                  或開啟即時寵物監控攝影機以自動採樣累積日常情緒數據。
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {/* 顯示本地 AI 拍照歷史（若有） */}
                {Array.isArray(photoLogs) && photoLogs.map((log, index) => {
                  const badge = getMoodBadge(log?.mood)
                  const Icon = badge.icon
                  const isExpanded = expandedLogId === log?.id

                  return (
                    <div
                      key={log?.id || `photo-${index}`}
                      className={`border border-[#191919] ${badge.borderL} bg-white p-3 text-xs shadow-xs transition-colors`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#8a8a8a]">
                            {log?.recordedAt && !isNaN(new Date(log.recordedAt).getTime())
                              ? new Date(log.recordedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              : '--:--:--'}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] border ${badge.cls}`}>
                            <Icon size={11} />
                            <span>{badge.label}</span>
                          </span>
                          <span className="font-mono text-[9px] bg-[#191919] text-[#fffa00] px-1.5 py-0.5 border border-[#191919] font-bold shadow-2xs">
                            AI_PHOTO
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log?.id)}
                          className="text-[11px] font-mono text-[#8a8a8a] hover:text-[#191919] flex items-center gap-0.5"
                        >
                          <span>{isExpanded ? '收合' : '完整報告'}</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>

                      <p className="text-xs text-[#555] mt-1 font-sans">
                        毛孩神情特寫拍照分析：判斷為「{log?.mood || '放鬆'}」
                      </p>

                      {isExpanded && (
                        <div className="mt-2.5 pt-2 border-t border-[#f0f0f0] bg-[#fafafa] p-2.5 text-xs leading-relaxed whitespace-pre-wrap font-sans text-[#191919]">
                          {log?.thumb && (
                            <img src={log.thumb} alt="採樣相片" className="h-20 w-auto object-cover mb-2 border border-[#d9d9d9]" />
                          )}
                          {log?.analysis}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* 顯示攝影機與感應器之歷史紀錄 */}
                {Array.isArray(allTimelineRecords) && allTimelineRecords.map((item, index) => {
                  const badge = getMoodBadge(item?.mood)
                  const Icon = badge.icon
                  const timeStr = item?.recordedAt || item?.recorded_at

                  return (
                    <div
                      key={item?.id || `rec-${index}`}
                      className={`border border-[#e5e5e5] ${badge.borderL} bg-white hover:bg-[#fafafa] p-2.5 text-xs flex items-center justify-between gap-2 shadow-2xs transition-colors`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-[10px] text-[#8a8a8a] shrink-0">
                          {timeStr && !isNaN(new Date(timeStr).getTime())
                            ? new Date(timeStr).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
                            : '--:--'}
                        </span>

                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] border shrink-0 ${badge.cls}`}>
                          <Icon size={11} />
                          <span>{badge.label}</span>
                        </span>

                        <span className="text-[#555] text-xs truncate">
                          {item.behavior || '常態活動監測'}
                        </span>
                      </div>

                      <div className="text-right font-mono text-[10px] text-[#8a8a8a] shrink-0">
                        {item.confidence ? `CONF: ${Math.round(item.confidence * 100)}%` : 'CAM_SENSOR'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-3 pt-2.5 border-t border-[#f0f0f0] text-[10px] font-mono text-[#8a8a8a] flex items-center justify-between">
              <span>// TELEMETRY_STREAM // 即時同步更新中</span>
              <button
                type="button"
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ['pet-mood-records', currentPet?.id] })
                  qc.invalidateQueries({ queryKey: ['mood-summary', currentPet?.id] })
                }}
                className="hover:text-[#191919] flex items-center gap-1 font-bold"
              >
                <Clock size={11} />
                <span>手動重整</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}